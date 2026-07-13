using LoboFlix.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LoboFlix.Api.Data.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260707023000_AddNightScheduleSettings")]
    public partial class AddNightScheduleSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "NightDurationMinutes",
                table: "ScheduleConfigs",
                type: "INTEGER",
                nullable: false,
                defaultValue: 240);

            migrationBuilder.AddColumn<string>(
                name: "NightStartTime",
                table: "ScheduleConfigs",
                type: "TEXT",
                nullable: false,
                defaultValue: "19:00");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NightDurationMinutes",
                table: "ScheduleConfigs");

            migrationBuilder.DropColumn(
                name: "NightStartTime",
                table: "ScheduleConfigs");
        }
    }
}
