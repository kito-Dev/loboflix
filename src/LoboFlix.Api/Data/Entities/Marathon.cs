namespace LoboFlix.Api.Data.Entities;

public class Marathon
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<MarathonMovie> Movies { get; set; } = [];
}

public class MarathonMovie
{
    public Guid MarathonId { get; set; }
    public Marathon Marathon { get; set; } = null!;
    public int MovieId { get; set; }
    public Movie Movie { get; set; } = null!;
    public int OrderIndex { get; set; }
}
