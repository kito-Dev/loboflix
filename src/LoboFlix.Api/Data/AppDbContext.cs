using LoboFlix.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace LoboFlix.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Movie> Movies => Set<Movie>();
    public DbSet<UserMovie> UserMovies => Set<UserMovie>();
    public DbSet<ScheduleConfig> ScheduleConfigs => Set<ScheduleConfig>();
    public DbSet<ScheduleEntry> ScheduleEntries => Set<ScheduleEntry>();
    public DbSet<Marathon> Marathons => Set<Marathon>();
    public DbSet<MarathonMovie> MarathonMovies => Set<MarathonMovie>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.Email).IsUnique();
        });

        modelBuilder.Entity<Movie>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.TmdbId, x.MediaType }).IsUnique();
        });

        modelBuilder.Entity<UserMovie>(e =>
        {
            e.HasKey(x => new { x.UserId, x.MovieId });
            e.HasOne(x => x.User).WithMany(x => x.Library).HasForeignKey(x => x.UserId);
            e.HasOne(x => x.Movie).WithMany(x => x.UserMovies).HasForeignKey(x => x.MovieId);
        });

        modelBuilder.Entity<ScheduleConfig>(e =>
        {
            e.HasKey(x => x.UserId);
            e.HasOne(x => x.User).WithOne(x => x.ScheduleConfig).HasForeignKey<ScheduleConfig>(x => x.UserId);
        });

        modelBuilder.Entity<ScheduleEntry>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.UserId, x.ScheduledDate });
            e.HasOne(x => x.User).WithMany(x => x.ScheduleEntries).HasForeignKey(x => x.UserId);
            e.HasOne(x => x.Movie).WithMany(x => x.ScheduleEntries).HasForeignKey(x => x.MovieId);
            e.HasOne(x => x.Marathon).WithMany().HasForeignKey(x => x.MarathonId);
        });

        modelBuilder.Entity<Marathon>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasOne(x => x.User).WithMany(x => x.Marathons).HasForeignKey(x => x.UserId);
        });

        modelBuilder.Entity<MarathonMovie>(e =>
        {
            e.HasKey(x => new { x.MarathonId, x.MovieId });
            e.HasOne(x => x.Marathon).WithMany(x => x.Movies).HasForeignKey(x => x.MarathonId);
            e.HasOne(x => x.Movie).WithMany(x => x.MarathonMovies).HasForeignKey(x => x.MovieId);
        });
    }
}
