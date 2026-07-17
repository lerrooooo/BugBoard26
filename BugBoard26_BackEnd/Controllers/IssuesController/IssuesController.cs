using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BugBoard26_BackEnd.Data;
using BugBoard26_BackEnd.Models;

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
        public async Task<IActionResult> Get()
        {
            var issues = await _context.Issues.ToListAsync();
            return Ok(issues);
        }

        [HttpPost]
        public async Task<IActionResult> Post([FromBody] Issue nuovaIssue)
        {
            _context.Issues.Add(nuovaIssue);

            await _context.SaveChangesAsync();

            return Ok(nuovaIssue);
        }
    }
}