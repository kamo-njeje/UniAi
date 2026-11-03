using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using UniAi.Api.Services;

public class StudyGenerationServiceTests
{
    private sealed class FakeHandler(HttpStatusCode status, string body) : HttpMessageHandler
    {
        public string? RequestBody { get; private set; }
        public string? Authorization { get; private set; }
        public Uri? RequestUri { get; private set; }
        public string? ApiKeyHeader { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            RequestBody = request.Content is null ? null : await request.Content.ReadAsStringAsync(cancellationToken);
            Authorization = request.Headers.Authorization?.ToString();
            RequestUri = request.RequestUri;
            ApiKeyHeader = request.Headers.TryGetValues("x-goog-api-key", out var values) ? values.FirstOrDefault() : null;
            return new HttpResponseMessage(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") };
        }
    }

    private static IConfiguration Config(string? key) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["OPENAI_API_KEY"] = key })
            .Build();

    private static string Wrap(string outputText, object[]? annotations = null) =>
        JsonSerializer.Serialize(new
        {
            output = new[]
            {
                new { content = new[] { new { type = "output_text", text = outputText, annotations = annotations ?? [] } } }
            }
        });

    private static string SummaryJson(int questions) =>
        JsonSerializer.Serialize(new
        {
            summary = "A short summary.",
            quiz = new
            {
                title = "Checkpoint",
                depth = "quick",
                questions = Enumerable.Range(1, questions).Select(i => new
                {
                    type = "true_false",
                    prompt = $"Question {i}?",
                    options = new[] { "True", "False" },
                    correctAnswers = new[] { "True" },
                    answer = "",
                    explanation = "Because.",
                    sourceReference = "Page 1"
                })
            }
        });

    private static StudyGenerationService Service(FakeHandler handler, string? key = "test-key") =>
        new(new HttpClient(handler), Config(key));

    private static StudyGenerationService Service(FakeHandler handler, Dictionary<string, string?> settings) =>
        new(new HttpClient(handler), new ConfigurationBuilder().AddInMemoryCollection(settings).Build());

    [Fact]
    public void Service_without_a_key_is_not_configured()
    {
        Assert.False(Service(new FakeHandler(HttpStatusCode.OK, "{}"), key: "  ").IsConfigured);
    }

    [Fact]
    public async Task Generate_without_a_key_throws()
    {
        var service = Service(new FakeHandler(HttpStatusCode.OK, "{}"), key: null);
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.GenerateAsync("text", "summary", "quick", default));
    }

    [Fact]
    public async Task Text_over_the_limit_is_rejected_before_calling_the_provider()
    {
        var handler = new FakeHandler(HttpStatusCode.OK, "{}");
        await Assert.ThrowsAsync<InvalidDataException>(() =>
            Service(handler).GenerateAsync(new string('a', 120_001), "summary", "quick", default));
        Assert.Null(handler.RequestBody);
    }

    [Fact]
    public async Task Summary_mode_returns_summary_and_quiz()
    {
        var handler = new FakeHandler(HttpStatusCode.OK, Wrap(SummaryJson(5)));
        var result = await Service(handler).GenerateAsync("lecture text", "summary", "quick", default);

        Assert.Equal("A short summary.", result.Text);
        Assert.NotNull(result.Quiz);
        Assert.Equal(5, result.Quiz!.Questions.Count);
    }

    [Fact]
    public async Task Summary_request_is_not_stored_and_sends_a_bearer_key_without_tools()
    {
        var handler = new FakeHandler(HttpStatusCode.OK, Wrap(SummaryJson(5)));
        await Service(handler).GenerateAsync("lecture text", "summary", "quick", default);

        using var request = JsonDocument.Parse(handler.RequestBody!);
        Assert.False(request.RootElement.GetProperty("store").GetBoolean());
        Assert.False(request.RootElement.TryGetProperty("tools", out _));
        Assert.Equal("Bearer test-key", handler.Authorization);
    }

    [Fact]
    public async Task Broaden_request_requires_web_search()
    {
        var handler = new FakeHandler(HttpStatusCode.OK, Wrap("Broader explanation."));
        await Service(handler).GenerateAsync("lecture text", "broaden", "quick", default);

        using var request = JsonDocument.Parse(handler.RequestBody!);
        Assert.Equal("required", request.RootElement.GetProperty("tool_choice").GetString());
        Assert.True(request.RootElement.TryGetProperty("tools", out _));
    }

    [Fact]
    public async Task Quiz_with_fewer_than_five_questions_is_rejected()
    {
        var handler = new FakeHandler(HttpStatusCode.OK, Wrap(SummaryJson(4)));
        await Assert.ThrowsAsync<StudyProviderException>(() =>
            Service(handler).GenerateAsync("text", "summary", "quick", default));
    }

    [Fact]
    public async Task Non_json_summary_output_is_rejected()
    {
        var handler = new FakeHandler(HttpStatusCode.OK, Wrap("not json at all"));
        await Assert.ThrowsAsync<StudyProviderException>(() =>
            Service(handler).GenerateAsync("text", "summary", "quick", default));
    }

    [Theory]
    [InlineData(HttpStatusCode.Unauthorized, 401)]
    [InlineData(HttpStatusCode.TooManyRequests, 429)]
    [InlineData(HttpStatusCode.InternalServerError, 500)]
    public async Task Provider_http_errors_surface_the_status_code(HttpStatusCode status, int expected)
    {
        var ex = await Assert.ThrowsAsync<StudyProviderException>(() =>
            Service(new FakeHandler(status, "{}")).GenerateAsync("text", "summary", "quick", default));
        Assert.Equal(expected, ex.StatusCode);
    }

    [Fact]
    public async Task Broaden_citations_keep_only_unique_https_links()
    {
        var annotations = new object[]
        {
            new { type = "url_citation", url = "https://example.edu/a", title = "Example A" },
            new { type = "url_citation", url = "https://example.edu/a", title = "Example A again" },
            new { type = "url_citation", url = "http://insecure.example.com/b", title = "Insecure" },
            new { type = "file_citation", file_id = "x" }
        };
        var handler = new FakeHandler(HttpStatusCode.OK, Wrap("Explained.", annotations));
        var result = await Service(handler).GenerateAsync("text", "broaden", "quick", default);

        var citation = Assert.Single(result.Citations);
        Assert.Equal("https://example.edu/a", citation.Url);
        Assert.Equal("Example A", citation.Title);
    }


    [Fact]
    public async Task Gemini_provider_sends_key_in_a_header_and_parses_the_quiz()
    {
        var body = JsonSerializer.Serialize(new
        {
            candidates = new[] { new { content = new { parts = new[] { new { text = SummaryJson(5) } } } } }
        });
        var handler = new FakeHandler(HttpStatusCode.OK, body);
        var service = Service(handler, new Dictionary<string, string?> { ["AI:Provider"] = "gemini", ["GEMINI_API_KEY"] = "g-key" });

        var result = await service.GenerateAsync("lecture text", "summary", "quick", default);

        Assert.Equal(5, result.Quiz!.Questions.Count);
        Assert.Contains(":generateContent", handler.RequestUri!.AbsoluteUri);
        Assert.Equal("g-key", handler.ApiKeyHeader);
        Assert.DoesNotContain("g-key", handler.RequestUri.AbsoluteUri);
    }

    [Fact]
    public async Task Groq_provider_uses_chat_completions_and_tolerates_code_fences()
    {
        var fenced = "```json\n" + SummaryJson(5) + "\n```";
        var body = JsonSerializer.Serialize(new { choices = new[] { new { message = new { content = fenced } } } });
        var handler = new FakeHandler(HttpStatusCode.OK, body);
        var service = Service(handler, new Dictionary<string, string?> { ["AI:Provider"] = "groq", ["GROQ_API_KEY"] = "q-key" });

        var result = await service.GenerateAsync("lecture text", "summary", "quick", default);

        Assert.Equal("A short summary.", result.Text);
        Assert.Equal("Bearer q-key", handler.Authorization);
        Assert.EndsWith("/chat/completions", handler.RequestUri!.AbsoluteUri);
        Assert.Contains("json_object", handler.RequestBody);
    }

    [Fact]
    public async Task Missing_quiz_fields_from_a_weaker_model_are_filled_in()
    {
        var sparse = JsonSerializer.Serialize(new
        {
            summary = "S",
            quiz = new
            {
                title = "T",
                depth = "quick",
                questions = Enumerable.Range(1, 5).Select(i => new { type = "multiple_choice", prompt = $"Q{i}?", options = new[] { "A", "B" } })
            }
        });
        var body = JsonSerializer.Serialize(new { choices = new[] { new { message = new { content = sparse } } } });
        var service = Service(new FakeHandler(HttpStatusCode.OK, body),
            new Dictionary<string, string?> { ["AI:Provider"] = "groq", ["GROQ_API_KEY"] = "q-key" });

        var result = await service.GenerateAsync("text", "summary", "quick", default);

        var question = result.Quiz!.Questions[0];
        Assert.Equal("single_choice", question.Type);
        Assert.NotNull(question.CorrectAnswers);
        Assert.Equal("", question.Explanation);
    }

    [Fact]
    public async Task Broaden_mode_is_not_available_without_openai()
    {
        var service = Service(new FakeHandler(HttpStatusCode.OK, "{}"),
            new Dictionary<string, string?> { ["AI:Provider"] = "gemini", ["GEMINI_API_KEY"] = "g-key" });
        await Assert.ThrowsAsync<InvalidDataException>(() => service.GenerateAsync("text", "broaden", "quick", default));
    }

    [Fact]
    public async Task Groq_rejects_text_over_its_smaller_input_limit()
    {
        var handler = new FakeHandler(HttpStatusCode.OK, "{}");
        var service = Service(handler, new Dictionary<string, string?> { ["AI:Provider"] = "groq", ["GROQ_API_KEY"] = "q-key" });
        await Assert.ThrowsAsync<InvalidDataException>(() => service.GenerateAsync(new string('a', 15_001), "summary", "quick", default));
        Assert.Null(handler.RequestBody);
    }

    [Fact]
    public void Gemini_needs_its_own_key_and_unknown_providers_are_not_configured()
    {
        var handler = new FakeHandler(HttpStatusCode.OK, "{}");
        var geminiWithOpenAiKey = Service(handler, new Dictionary<string, string?> { ["AI:Provider"] = "gemini", ["OPENAI_API_KEY"] = "x" });
        Assert.False(geminiWithOpenAiKey.IsConfigured);
        Assert.Contains("GEMINI_API_KEY", geminiWithOpenAiKey.ConfigurationHint);

        var typo = Service(handler, new Dictionary<string, string?> { ["AI:Provider"] = "gemni", ["GEMINI_API_KEY"] = "x" });
        Assert.False(typo.IsConfigured);
    }
}
