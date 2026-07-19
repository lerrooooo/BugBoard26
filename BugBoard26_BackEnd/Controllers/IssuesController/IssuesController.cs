using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Security.Claims;
using BugBoard26_BackEnd.Data;
using BugBoard26_BackEnd.Models;
using BugBoard26_BackEnd.Models.Enums;

namespace BugBoard26_BackEnd.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class IssuesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public IssuesController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        [Authorize]
        public async Task<IActionResult> Get()
        {
            var role = User.FindFirstValue(ClaimTypes.Role);

            var query = _context.Issues.AsQueryable();

            if (role == "User")
            {
                var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
                if (userIdClaim == null || !int.TryParse(userIdClaim, out var userId))
                    return Unauthorized();

                query = query.Where(i => i.AccessEntries.Any(a => a.UserId == userId));
            }

            var issues = await query
                .Select(i => new
                {
                    i.Id,
                    i.Title,
                    i.Description,
                    i.Type,
                    i.Priority,
                    i.Status,
                    i.ImageUrl,
                    i.DueDate,
                    Viewers = i.AccessEntries
                        .Select(a => new { a.UserId, Email = a.User!.Email })
                        .ToList()
                })
                .ToListAsync();

            return Ok(issues);
        }

        [HttpPost]
        [Authorize]
        public async Task<IActionResult> CreateIssue(
            [FromForm] string title,
            [FromForm] string? description,
            [FromForm] IssueType type,
            [FromForm] Priority priority,
            [FromForm] List<int>? accessUserIds,
            [FromForm] string? dueDate,
            [FromForm] IFormFile? image)
        {
            var role = User.FindFirstValue(ClaimTypes.Role);
            var isAdmin = role == "Admin";

            DateTime? parsedDueDate = null;
            if (isAdmin && !string.IsNullOrWhiteSpace(dueDate))
            {
                if (!DateTime.TryParseExact(dueDate, "yyyy-MM-dd", CultureInfo.InvariantCulture,
                        DateTimeStyles.None, out var d))
                {
                    return BadRequest("Formato data non valido per la scadenza (atteso yyyy-MM-dd).");
                }
                parsedDueDate = DateTime.SpecifyKind(d, DateTimeKind.Utc);
            }

            string? imageUrl = null;

            if (image != null)
            {
                var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads");
                Directory.CreateDirectory(uploadsDir);

                var fileName = $"{Guid.NewGuid()}{Path.GetExtension(image.FileName)}";
                var filePath = Path.Combine(uploadsDir, fileName);

                using var stream = new FileStream(filePath, FileMode.Create);
                await image.CopyToAsync(stream);

                imageUrl = $"/uploads/{fileName}";
            }

            var issue = new Issue
            {
                Title = title,
                Description = description,
                Type = type,
                Priority = priority,
                Status = IssueStatus.Todo,
                ImageUrl = imageUrl,
                //solo un admin può impostare una scadenza per la risoluzione
                DueDate = parsedDueDate
            };

            List<int> ids;
            if (isAdmin)
            {
                ids = accessUserIds?.Distinct().ToList() ?? new List<int>();
            }
            else
            {
                var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
                ids = int.TryParse(userIdClaim, out var creatorId)
                    ? new List<int> { creatorId }
                    : new List<int>();
            }

            issue.AccessEntries = ids.Select(uid => new IssueAccess { UserId = uid }).ToList();

            _context.Issues.Add(issue);
            await _context.SaveChangesAsync();

            return Ok(issue);
        }

        public class UpdateIssueDto
        {
            public required string Title { get; set; }
            public string? Description { get; set; }
            public IssueType Type { get; set; }
            public Priority Priority { get; set; }
            public IssueStatus Status { get; set; }
            public List<int>? AccessUserIds { get; set; }
            public DateTime? DueDate { get; set; }
        }

        [HttpPut("{id}")]
        [Authorize]
        public async Task<IActionResult> UpdateIssue(int id, [FromBody] UpdateIssueDto dto)
        {
            var issue = await _context.Issues
                .Include(i => i.AccessEntries)
                .FirstOrDefaultAsync(i => i.Id == id);
            if (issue == null) return NotFound();

            var role = User.FindFirstValue(ClaimTypes.Role);
            var isAdmin = role == "Admin";

            if (!isAdmin)
            {
                var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
                var hasAccess = role == "User"
                    && userIdClaim != null
                    && int.TryParse(userIdClaim, out var userId)
                    && issue.AccessEntries.Any(a => a.UserId == userId);

                if (!hasAccess) return Forbid();
            }

            issue.Title = dto.Title;
            issue.Description = dto.Description;
            issue.Type = dto.Type;
            issue.Priority = dto.Priority;
            issue.Status = dto.Status;

            if (isAdmin)
            {
                issue.DueDate = dto.DueDate.HasValue
                    ? DateTime.SpecifyKind(dto.DueDate.Value, DateTimeKind.Utc)
                    : null;
            }

            if (isAdmin && dto.AccessUserIds != null)
            {
                _context.IssueAccess.RemoveRange(issue.AccessEntries);
                issue.AccessEntries = dto.AccessUserIds.Distinct()
                    .Select(uid => new IssueAccess { IssueId = issue.Id, UserId = uid })
                    .ToList();
            }

            await _context.SaveChangesAsync();

            var updated = await _context.Issues
                .Where(i => i.Id == issue.Id)
                .Select(i => new
                {
                    i.Id,
                    i.Title,
                    i.Description,
                    i.Type,
                    i.Priority,
                    i.Status,
                    i.ImageUrl,
                    i.DueDate,
                    Viewers = i.AccessEntries
                        .Select(a => new { a.UserId, Email = a.User!.Email })
                        .ToList()
                })
                .FirstAsync();

            return Ok(updated);
        }
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteIssue(int id)
        {
            var issue = await _context.Issues.FindAsync(id);
            if (issue == null) return NotFound();

            if (!string.IsNullOrEmpty(issue.ImageUrl))
            {
                var filePath = Path.Combine(
                    Directory.GetCurrentDirectory(), "wwwroot",
                    issue.ImageUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));
                if (System.IO.File.Exists(filePath))
                {
                    System.IO.File.Delete(filePath);
                }
            }
            _context.Issues.Remove(issue);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}