using System.Text.Json.Serialization;
using BugBoard26_BackEnd.Models.Enums;

namespace BugBoard26_BackEnd.Models
{
    public class Issue
    {
        public int Id { get; set; }
        public required string Title { get; set; }
        public string? Description { get; set; }
        public IssueType Type { get; set; }
        public Priority Priority { get; set; } = Priority.Medium;
        public IssueStatus Status { get; set; } = IssueStatus.Todo;
        public string? ImageUrl { get; set; }

        public DateTime? DueDate { get; set; }

        [JsonIgnore]
        public ICollection<IssueAccess> AccessEntries { get; set; } = new List<IssueAccess>();
    }
}