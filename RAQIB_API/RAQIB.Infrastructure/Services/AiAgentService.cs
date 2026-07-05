using System.Net.Http.Json;
using System.Text.Json;
using RAQIB.Core.DTOs;
using RAQIB.Core.Interfaces;

namespace RAQIB.Infrastructure.Services;

public class AiAgentService : IAiAgentService
{
    private readonly HttpClient _http;

    public AiAgentService(HttpClient http) => _http = http;

    public async Task<AiPredictionDto> PredictAsync(Stream imageStream, string fileName)
    {
        using var content = new MultipartFormDataContent();
        using var sc = new StreamContent(imageStream);
        sc.Headers.ContentType = new("image/jpeg");
        content.Add(sc, "file", fileName);

        var response = await _http.PostAsync("/predict", content);
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();

        return new AiPredictionDto(
            json.GetProperty("predicted_class").GetString()!,
            json.GetProperty("severity_label").GetString()!,
            json.GetProperty("severity_score").GetInt32(),
            json.GetProperty("confidence").GetDouble(),
            json.GetProperty("ai_reply").GetString()!,
            json.GetProperty("all_probs")
                .EnumerateObject()
                .ToDictionary(p => p.Name, p => p.Value.GetDouble())
        );
    }
}
