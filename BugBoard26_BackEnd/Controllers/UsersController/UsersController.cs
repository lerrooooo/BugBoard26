using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BugBoard26_BackEnd.Data;
using BugBoard26_BackEnd.Models;
using BugBoard26_BackEnd.Models.Enums;

namespace BugBoard26_BackEnd.Controllers
{
    [ApiController]
    [Route("api/users")]
    [Authorize(Roles = "Admin")]
    public class UsersController : ControllerBase
    {
        private readonly AppDbContext _context;

        public UsersController(AppDbContext context)
        {
            _context = context;
        }

        public record CreateUserRequest(string Email, string Password, UserType Type);

        [HttpPost]
        public async Task<IActionResult> CreateUser(CreateUserRequest request)
        {
            var exists = await _context.Users.AnyAsync(u => u.Email == request.Email);
            if (exists)
                return Conflict(new { message = "Esiste già un utente con questa email." });

            var user = new User
            {
                Email = request.Email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                Type = request.Type
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return Ok(new { user.Id, user.Email, user.Type });
        }

        [HttpGet]
        public async Task<IActionResult> GetUsers()
        {
            var users = await _context.Users
                .Select(u => new { u.Id, u.Email, u.Type })
                .ToListAsync();
            return Ok(users);
        }
    }
}