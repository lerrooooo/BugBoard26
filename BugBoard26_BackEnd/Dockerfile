FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY ["BugBoard26.csproj", "./"]
RUN dotnet restore "BugBoard26.csproj"
COPY . .
RUN dotnet publish "BugBoard26.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "BugBoard26.dll"]