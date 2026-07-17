using Microsoft.EntityFrameworkCore;
using BugBoard26_BackEnd.Models.Enums;

namespace BugBoard26_BackEnd.Models
{
    [Index(nameof(Email), IsUnique = true)]
    public class User
    {
        public int Id { get; set; }
        public string Email { get; set; }
        public string PasswordHash { get; set; }
        public UserType Type { get; set; }
    }
}