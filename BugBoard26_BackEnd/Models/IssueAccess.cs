using System.Text.Json.Serialization;

namespace BugBoard26_BackEnd.Models
{
    public class IssueAccess
    {
        public int IssueId { get; set; }

        [JsonIgnore]
        public Issue? Issue { get; set; }

        public int UserId { get; set; }

        [JsonIgnore]
        public User? User { get; set; }
    }
}