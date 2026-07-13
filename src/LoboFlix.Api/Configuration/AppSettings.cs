namespace LoboFlix.Api.Configuration;

public class JwtSettings
{
    public const string SectionName = "Jwt";
    public string Secret { get; set; } = "change-me-in-production-use-a-long-random-string";
    public string Issuer { get; set; } = "LoboFlix";
    public int ExpirationHours { get; set; } = 168;
}

public class TmdbSettings
{
    public const string SectionName = "Tmdb";
    public string ApiKey { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = "https://api.themoviedb.org/3";
    public string ImageBaseUrl { get; set; } = "https://image.tmdb.org/t/p";
    public string DefaultCountry { get; set; } = "BR";
}

public class OpenAiSettings
{
    public const string SectionName = "OpenAi";
    public string ApiKey { get; set; } = string.Empty;
    public string Model { get; set; } = "gpt-4o-mini";
    public string BaseUrl { get; set; } = "https://api.openai.com/v1";
}

public class OmdbSettings
{
    public const string SectionName = "Omdb";
    public string ApiKey { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = "https://www.omdbapi.com/";
}
