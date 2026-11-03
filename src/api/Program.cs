using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using UniAi.Api.Services;

const long maxRequestBytes = 40L * 1024 * 1024;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = maxRequestBytes);
builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = maxRequestBytes;
    options.MemoryBufferThreshold = (int)maxRequestBytes;
});

var allowedOrigins = builder.Configuration
    .GetSection("AllowedOrigins")
    .Get<string[]>() ?? [];

builder.Services.AddCors(options =>
{
    options.AddPolicy("LocalWeb", policy =>
    {
        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

// Fast per-IP burst limit. Daily and global caps live in UsageLimiter.
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("study-generation", httpContext =>
    {
        var ip = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var burst = httpContext.RequestServices.GetRequiredService<IConfiguration>()
            .GetValue<int?>("Limits:BurstPerIpPerMinute") ?? 3;
        return RateLimitPartition.GetFixedWindowLimiter(ip, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = Math.Max(1, burst),
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0
        });
    });
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
        {
            context.HttpContext.Response.Headers.RetryAfter = ((int)Math.Ceiling(retryAfter.TotalSeconds)).ToString();
        }

        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            title = "Too many requests",
            detail = "You are going a little fast. Please wait a minute and try again."
        }, cancellationToken);
    };
});

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<UsageLimiter>();
builder.Services.AddSingleton<DocumentTextExtractor>();
builder.Services.AddHttpClient<StudyGenerationService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(90);
});

var app = builder.Build();

app.UseCors("LocalWeb");
app.UseRateLimiter();

app.MapGet("/health", () => Results.Ok(new
{
    status = "ok",
    service = "UniAI API"
}));

if (app.Environment.IsDevelopment())
{
app.MapPost("/api/study/generate", async (
    HttpRequest request,
    DocumentTextExtractor extractor,
    StudyGenerationService generator,
    UsageLimiter limiter,
    CancellationToken cancellationToken) =>
{
    request.HttpContext.Response.Headers["Cache-Control"] = "no-store";

    var origin = request.Headers.Origin.ToString();
    if (!allowedOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase))
    {
        return Results.StatusCode(StatusCodes.Status403Forbidden);
    }

    if (!generator.IsConfigured)
    {
        return Results.Problem(
            title: "AI provider not configured",
            detail: generator.ConfigurationHint,
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    if (!request.HasFormContentType)
    {
        return Results.BadRequest(new { error = "Upload the study material as a multipart form." });
    }

    var form = await request.ReadFormAsync(cancellationToken);
    var mode = form["mode"].FirstOrDefault()?.Trim().ToLowerInvariant();
    if (mode is not ("summary" or "broaden"))
    {
        return Results.BadRequest(new { error = "Choose summary or broaden mode." });
    }

    var depth = form["depth"].FirstOrDefault()?.Trim().ToLowerInvariant() ?? "quick";
    if (depth is not ("quick" or "deep"))
    {
        return Results.BadRequest(new { error = "Choose quick or deep summary depth." });
    }

    var files = form.Files.GetFiles("files");
    if (files.Count is < 1 or > 3)
    {
        return Results.BadRequest(new { error = "Choose between one and three documents." });
    }

    if (files.Any(file => file.Length > DocumentTextExtractor.MaxFileBytes))
    {
        return Results.BadRequest(new { error = "Each document must be 20 MB or smaller." });
    }

    try
    {
        var extractedDocuments = new List<ExtractedDocument>();
        foreach (var file in files)
        {
            extractedDocuments.Add(await extractor.ExtractAsync(file, cancellationToken));
        }

        var combinedText = string.Join("\n\n", extractedDocuments.Select(document =>
            $"--- Document: {document.FileName} ---\n{document.Text}"));

        var ip = request.HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var guestHeader = request.Headers["X-UniAI-Guest"].FirstOrDefault();
        var guestId = Guid.TryParse(guestHeader, out var parsedGuest) ? parsedGuest.ToString() : null;

        var quota = limiter.TryAcquire(ip, guestId);
        if (!quota.Allowed)
        {
            request.HttpContext.Response.Headers.RetryAfter = ((int)Math.Ceiling(quota.RetryAfter.TotalSeconds)).ToString();
            return Results.Problem(
                title: "Usage limit reached",
                detail: quota.Message,
                statusCode: StatusCodes.Status429TooManyRequests);
        }

        var result = await generator.GenerateAsync(combinedText, mode, depth, cancellationToken);

        return Results.Ok(new
        {
            mode,
            result.Text,
            result.Citations,
            result.Quiz,
            documents = extractedDocuments.Select(document => new { document.FileName, document.CharacterCount })
        });
    }
    catch (InvalidDataException exception)
    {
        return Results.BadRequest(new { error = exception.Message });
    }
    catch (StudyProviderException exception)
    {
        var detail = exception.StatusCode switch
        {
            401 or 403 => "OpenAI rejected the API key or project access (HTTP " + exception.StatusCode + "). Check that you entered the secret key and that it belongs to an API project you can use.",
            429 => "OpenAI rejected the request because of a usage limit or billing quota (HTTP 429). Check API billing and usage limits.",
            400 => "OpenAI rejected the request (HTTP 400). Check model availability for this API project.",
            int statusCode when statusCode >= 500 => "OpenAI returned a temporary server error (HTTP " + statusCode + "). Try again shortly.",
            null => "The API could not reach OpenAI or could not read its response. Check your internet connection and try again.",
            _ => "The OpenAI request failed (HTTP " + exception.StatusCode + "). Check the API key, billing, and project access."
        };
        detail = detail.Replace("OpenAI", generator.ProviderName);
        return Results.Problem(
            title: "Study material could not be generated",
            detail: detail,
            statusCode: StatusCodes.Status502BadGateway);
    }
}).RequireRateLimiting("study-generation");
}

app.Run();


// Lets the test project use WebApplicationFactory<Program>.
public partial class Program { }
