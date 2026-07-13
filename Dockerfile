FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY LoboFlix.sln ./
COPY src/LoboFlix.Api/LoboFlix.Api.csproj src/LoboFlix.Api/
RUN dotnet restore src/LoboFlix.Api/LoboFlix.Api.csproj

COPY src/LoboFlix.Api/ src/LoboFlix.Api/

FROM build AS publish
WORKDIR /src/web
COPY web/package*.json ./
RUN apt-get update && apt-get install -y curl \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && npm ci || npm install

COPY web/ ./
RUN npm run build

WORKDIR /src
RUN dotnet publish src/LoboFlix.Api/LoboFlix.Api.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

COPY --from=publish /app/publish ./

EXPOSE 8080
ENTRYPOINT ["dotnet", "LoboFlix.Api.dll"]
