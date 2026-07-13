using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LoboFlix.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddRottenTomatoesRating : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "RottenTomatoesRating",
                table: "Movies",
                type: "INTEGER",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RottenTomatoesRating",
                table: "Movies");
        }
    }
}
