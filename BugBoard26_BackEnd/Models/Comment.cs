using System.Text.Json.Serialization;

namespace BugBoard26_BackEnd.Models
{
    public class Comment
    {
        public int Id { get; set; }

        public int IssueId { get; set; }

        [JsonIgnore]
        public Issue? Issue { get; set; }

        public int UserId { get; set; }

        [JsonIgnore]
        public User? User { get; set; }

        public required string Text { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}