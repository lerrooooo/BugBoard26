using Microsoft.EntityFrameworkCore;
using BugBoard26_BackEnd.Models;

namespace BugBoard26_BackEnd.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<User> Users { get; set; }
        public DbSet<Issue> Issues { get; set; }
        public DbSet<Comment> Comments { get; set; }
        public DbSet<IssueAccess> IssueAccess { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.Entity<Comment>()
                .HasOne(c => c.Issue)
                .WithMany()
                .HasForeignKey(c => c.IssueId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Comment>()
                .HasOne(c => c.User)
                .WithMany()
                .HasForeignKey(c => c.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<IssueAccess>()
                .HasKey(ia => new { ia.IssueId, ia.UserId });

            modelBuilder.Entity<IssueAccess>()
                .HasOne(ia => ia.Issue)
                .WithMany(i => i.AccessEntries)
                .HasForeignKey(ia => ia.IssueId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<IssueAccess>()
                .HasOne(ia => ia.User)
                .WithMany()
                .HasForeignKey(ia => ia.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}