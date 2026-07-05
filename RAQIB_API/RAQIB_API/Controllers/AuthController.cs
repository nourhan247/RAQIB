using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.IdentityModel.Tokens;
using RAQIB.Core.DTOs;
using RAQIB.Core.Interfaces;
using RAQIB.Core.Models;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace RAQIB.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _users;
    private readonly SignInManager<ApplicationUser> _signIn;
    private readonly IConfiguration _config;
    private readonly IEmailService _email;

    public AuthController(
        UserManager<ApplicationUser> users,
        SignInManager<ApplicationUser> signIn,
        IConfiguration config,
        IEmailService email)
    {
        _users  = users;
        _signIn = signIn;
        _config = config;
        _email  = email;
    }

    [HttpGet("confirm-email")]
    public async Task<IActionResult> ConfirmEmail(string userId, string token)
    {
        var user = await _users.FindByIdAsync(userId);

        if (user == null)
            return BadRequest("User not found.");

        token = Encoding.UTF8.GetString(
            WebEncoders.Base64UrlDecode(token));

        var result = await _users.ConfirmEmailAsync(user, token);

        if (!result.Succeeded)
            return BadRequest(result.Errors);

        return Ok(new
        {
            message = "Email confirmed successfully."
        });
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterDto dto)
    {
        var user = new ApplicationUser
        {
            FullName = dto.FullName,
            Email = dto.Email,
            UserName = dto.Email
        };

        var result = await _users.CreateAsync(user, dto.Password);

        if (!result.Succeeded)
            return BadRequest(result.Errors.Select(e => e.Description));

        await _users.AddToRoleAsync(user, "User");

        // إنشاء Token لتأكيد الإيميل
        var token = await _users.GenerateEmailConfirmationTokenAsync(user);

        var encodedToken = WebEncoders.Base64UrlEncode(
            Encoding.UTF8.GetBytes(token));

        var confirmLink =
            $"http://localhost:5173/confirm-email?userId={user.Id}&token={encodedToken}";

        await _email.SendWelcomeEmailAsync(
            dto.Email,
            dto.FullName,
            confirmLink);

        return Ok(new
        {
            message = "تم إنشاء الحساب، يرجى تأكيد البريد الإلكتروني."
        });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginDto dto)
    {
        var user = await _users.FindByEmailAsync(dto.Email);

        if (user == null)
            return Unauthorized("بيانات غير صحيحة");

        if (!user.EmailConfirmed)
            return Unauthorized("يرجى تأكيد البريد الإلكتروني أولاً.");

        if (!user.IsActive)
            return Unauthorized("الحساب غير مفعل.");

        var result = await _signIn.CheckPasswordSignInAsync(user, dto.Password, false);

        if (!result.Succeeded)
            return Unauthorized("بيانات غير صحيحة");

        var roles = await _users.GetRolesAsync(user);

        var token = GenerateJwt(user, roles);

        return Ok(new AuthResultDto(
            token,
            user.Id,
            user.FullName,
            roles.FirstOrDefault() ?? "User",
            DateTime.UtcNow.AddDays(7)
        ));
    }

    private string GenerateJwt(ApplicationUser user, IList<string> roles)
    {
        var key    = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
        var creds  = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id),
            new(ClaimTypes.Email, user.Email!),
            new(ClaimTypes.Name, user.FullName),
        };
        claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));

        var token = new JwtSecurityToken(
            issuer:   _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims:   claims,
            expires:  DateTime.UtcNow.AddDays(7),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
