namespace LoboFlix.Api.Data.Entities;

public class User
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Country { get; set; } = "BR";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ScheduleConfig? ScheduleConfig { get; set; }
    public ICollection<UserMovie> Library { get; set; } = [];
    public ICollection<ScheduleEntry> ScheduleEntries { get; set; } = [];
    public ICollection<Marathon> Marathons { get; set; } = [];
}
