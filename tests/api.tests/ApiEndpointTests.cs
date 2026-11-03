using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using System.Net;
using System.Net.Http.Headers;
using Microsoft.AspNetCore.Mvc.Testing;

public class ApiEndpointTests(WebApplicationFactory<Program> factory) : IClassFixture<WebApplicationFactory<Program>>
{
    // Make sure a real key on the developer machine never leaks into tests.
    private HttpClient Client() => factory
        .WithWebHostBuilder(builder => builder.ConfigureAppConfiguration((_, config) =>
            config.AddInMemoryCollection(new Dictionary<string, string?> { ["OPENAI_API_KEY"] = "", ["AI:Provider"] = "openai" })))
        .CreateClient();

    [Fact]
    public async Task Health_reports_ok()
    {
        var response = await Client().GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("\"status\":\"ok\"", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Generate_from_an_unknown_origin_is_forbidden()
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/study/generate");
        request.Headers.Add("Origin", "https://evil.example.com");
        var response = await Client().SendAsync(request);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Generate_without_a_configured_key_returns_503()
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/study/generate");
        request.Headers.Add("Origin", "http://localhost:5173");
        var response = await Client().SendAsync(request);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
    }

    [Fact]
    public async Task Generate_with_a_known_origin_and_no_form_is_a_bad_request()
    {
        // A key must be present to get past the 503 check, so set a dummy one for this test only.
        var client = factory
            .WithWebHostBuilder(builder => builder.ConfigureAppConfiguration((_, config) =>
                config.AddInMemoryCollection(new Dictionary<string, string?> { ["OPENAI_API_KEY"] = "dummy", ["AI:Provider"] = "openai" })))
            .CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/study/generate")
        {
            Content = new StringContent("{}", System.Text.Encoding.UTF8, "application/json")
        };
        request.Headers.Add("Origin", "http://localhost:5173");
        var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Generate_over_the_burst_limit_returns_a_friendly_429()
    {
        var client = factory
            .WithWebHostBuilder(builder => builder.ConfigureAppConfiguration((_, config) =>
                config.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["OPENAI_API_KEY"] = "dummy",
                    ["AI:Provider"] = "openai",
                    ["Limits:BurstPerIpPerMinute"] = "2"
                })))
            .CreateClient();

        HttpResponseMessage? last = null;
        for (var i = 0; i < 3; i++)
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "/api/study/generate")
            {
                Content = new StringContent("{}", System.Text.Encoding.UTF8, "application/json")
            };
            request.Headers.Add("Origin", "http://localhost:5173");
            last = await client.SendAsync(request);
        }

        Assert.Equal(HttpStatusCode.TooManyRequests, last!.StatusCode);
        Assert.Contains("detail", await last.Content.ReadAsStringAsync());
    }
}
