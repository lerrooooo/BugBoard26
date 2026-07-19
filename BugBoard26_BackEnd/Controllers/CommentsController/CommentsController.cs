using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using BugBoard26_BackEnd.Data;
using BugBoard26_BackEnd.Models;
using BugBoard26_BackEnd.Models.Dtos;

namespace BugBoard26_BackEnd.Controllers
{
    [ApiController]
    [Route("api/issues/{issueId}/comments")]
    public class CommentsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public CommentsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetComments(int issueId)
        {
            var issueExists = await _context.Issues.AnyAsync(i => i.Id == issueId);
            if (!issueExists) return NotFound("Issue non trovata.");

            var comments = await _context.Comments
                .Where(c => c.IssueId == issueId)
                .OrderBy(c => c.CreatedAt)
                .Select(c => new
                {
                    c.Id,
                    c.Text,
                    c.CreatedAt,
                    AuthorEmail = c.User != null ? c.User.Email : "utente eliminato"
                })
                .ToListAsync();

            return Ok(comments);
        }

        [HttpPost]
        [Authorize]
        public async Task<IActionResult> AddComment(int issueId, [FromBody] CreateCommentDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Text))
                return BadRequest("Il commento non può essere vuoto.");

            var issueExists = await _context.Issues.AnyAsync(i => i.Id == issueId);
            if (!issueExists) return NotFound("Issue non trovata.");

            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userIdClaim == null || !int.TryParse(userIdClaim, out var userId))
                return Unauthorized();

            var comment = new Comment
            {
                IssueId = issueId,
                UserId = userId,
                Text = dto.Text.Trim(),
                CreatedAt = DateTime.UtcNow
            };

            _context.Comments.Add(comment);
            await _context.SaveChangesAsync();

            var author = await _context.Users.FindAsync(userId);

            return Ok(new
            {
                comment.Id,
                comment.Text,
                comment.CreatedAt,
                AuthorEmail = author?.Email ?? "sconosciuto"
            });
        }
    }
}