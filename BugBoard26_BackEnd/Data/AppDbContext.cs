using Microsoft.EntityFrameworkCore;
using BugBoard26_BackEnd.Models;

namespace BugBoard26_BackEnd.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<User> Users { get; set; }
        public DbSet<Issue> Issues { get; set; }
    }
}