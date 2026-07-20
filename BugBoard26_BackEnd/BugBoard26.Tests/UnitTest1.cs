using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;
using BugBoard26_BackEnd.Controllers;
using BugBoard26_BackEnd.Data;
using BugBoard26_BackEnd.Models;
using BugBoard26_BackEnd.Models.Dtos;
using BugBoard26_BackEnd.Models.Enums;

namespace BugBoard26_BackEnd.Tests
{
    public class Tests
    {
        // crea un db finto in memoria per i test
        private AppDbContext GetDb()
        {
            var opt = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;
            return new AppDbContext(opt);
        }

        // simula un utente loggato con un certo ruolo
        private void Login(ControllerBase c, int id, string role)
        {
            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, id.ToString()),
                new(ClaimTypes.Role, role)
            };
            var user = new ClaimsPrincipal(new ClaimsIdentity(claims, "test"));
            c.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext{User = user}
            };
        }

        //test 1: creazione issue da admin
        [Fact]
        public async Task CreateIssue_Admin_Funziona()
        {
            var db = GetDb();
            var ctrl = new IssuesController(db);
            Login(ctrl, 1, "Admin");

            var res = await ctrl.CreateIssue(
                "Bug login",
                "il login non va",
                IssueType.Bug,
                Priority.High,
                new List<int>{2, 3},
                "2026-08-01",
                null);

            var ok = Assert.IsType<OkObjectResult>(res);
            var issue = Assert.IsType<Issue>(ok.Value);

            Assert.Equal("Bug login", issue.Title);
            Assert.Equal(2, issue.AccessEntries.Count);
        }

        // test 2: update issue da utente senza permessi -> deve dare forbid
        [Fact]
        public async Task UpdateIssue_UtenteSenzaAccesso_DaForbid()
        {
            var db = GetDb();
            var issue = new Issue { Title = "test", Type = IssueType.Bug };
            db.Issues.Add(issue);
            await db.SaveChangesAsync();

            var ctrl = new IssuesController(db);
            Login(ctrl, 99, "User"); // utente 99 non ha accesso

            var dto = new IssuesController.UpdateIssueDto
            {
                Title = "modificato",
                Type = IssueType.Feature,
                Priority = Priority.Low,
                Status = IssueStatus.InProgress
            };

            var res = await ctrl.UpdateIssue(issue.Id, dto);

            Assert.IsType<ForbidResult>(res);
        }

        //test 3: aggiunta commento
        [Fact]
        public async Task AddComment_Funziona()
        {
            var db = GetDb();
            var user = new User { Email = "marco@test.com", PasswordHash = "x" };
            var issue = new Issue { Title = "test", Type = IssueType.Bug };
            db.Users.Add(user);
            db.Issues.Add(issue);
            await db.SaveChangesAsync();

            var ctrl = new CommentsController(db);
            Login(ctrl, user.Id, "User");

            var dto = new CreateCommentDto { Text = "  prova commento  " };

            var res = await ctrl.AddComment(issue.Id, dto);

            Assert.IsType<OkObjectResult>(res);
            var salvato = await db.Comments.FirstAsync();
            Assert.Equal("prova commento", salvato.Text);
        }
    }
}