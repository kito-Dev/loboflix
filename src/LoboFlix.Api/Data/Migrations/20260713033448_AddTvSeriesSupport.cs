using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LoboFlix.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddTvSeriesSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Movies_TmdbId",
                table: "Movies");

            migrationBuilder.AddColumn<int>(
                name: "EpisodeNumber",
                table: "Movies",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MediaType",
                table: "Movies",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "SeasonNumber",
                table: "Movies",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SeriesTitle",
                table: "Movies",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SeriesTmdbId",
                table: "Movies",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Movies_TmdbId_MediaType",
                table: "Movies",
                columns: new[] { "TmdbId", "MediaType" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Movies_TmdbId_MediaType",
                table: "Movies");

            migrationBuilder.DropColumn(
                name: "EpisodeNumber",
                table: "Movies");

            migrationBuilder.DropColumn(
                name: "MediaType",
                table: "Movies");

            migrationBuilder.DropColumn(
                name: "SeasonNumber",
                table: "Movies");

            migrationBuilder.DropColumn(
                name: "SeriesTitle",
                table: "Movies");

            migrationBuilder.DropColumn(
                name: "SeriesTmdbId",
                table: "Movies");

            migrationBuilder.CreateIndex(
                name: "IX_Movies_TmdbId",
                table: "Movies",
                column: "TmdbId",
                unique: true);
        }
    }
}
