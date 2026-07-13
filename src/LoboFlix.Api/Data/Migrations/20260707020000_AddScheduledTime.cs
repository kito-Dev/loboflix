using LoboFlix.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LoboFlix.Api.Data.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260707020000_AddScheduledTime")]
    public partial class AddScheduledTime : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ScheduledTime",
                table: "ScheduleEntries",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ScheduledTime",
                table: "ScheduleEntries");
        }
    }
}
