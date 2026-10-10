package com.plantvision.service;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.plantvision.dto.AuthRequest;
import com.plantvision.dto.AuthResponse;
import com.plantvision.dto.AuthUserView;
import com.plantvision.dto.LoginRequest;
import com.plantvision.entity.AppUser;
import com.plantvision.mapper.AppUserMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
  public static final String ROLE_ADMIN = "ADMIN";
  public static final String ROLE_USER = "USER";

  private final AppUserMapper appUserMapper;

  public AuthService(AppUserMapper appUserMapper) {
    this.appUserMapper = appUserMapper;
  }

  public AuthResponse register(AuthRequest request) {
    AppUser existing = findByUsername(request.username());
    if (existing != null) {
      throw new IllegalArgumentException("用户名已存在");
    }

    LocalDateTime now = LocalDateTime.now();
    AppUser user =
        AppUser.builder()
            .username(safeTrim(request.username()))
            .displayName(safeTrim(request.displayName()))
            .passwordHash(sha256(request.password()))
            .role(normalizeRequestedRole(request.role()))
            .createdAt(now)
            .updatedAt(now)
            .build();

    appUserMapper.insert(user);
    return new AuthResponse("注册成功", AuthUserView.from(user));
  }

  public AuthResponse login(LoginRequest request) {
    AppUser user = findByUsername(request.username());
    if (user == null || !user.getPasswordHash().equals(sha256(request.password()))) {
      throw new IllegalArgumentException("用户名或密码错误");
    }

    String requestedRole = normalizeRole(request.role());
    String actualRole = normalizeRole(user.getRole());
    if (!requestedRole.isBlank() && !requestedRole.equalsIgnoreCase(actualRole)) {
      throw new IllegalArgumentException("当前账号不属于所选角色");
    }

    return new AuthResponse("登录成功", AuthUserView.from(user));
  }

  public void initializeAdminIfNeeded() {
    AppUser existing = findByUsername("admin");
    if (existing != null) {
      if (existing.getRole() == null || existing.getRole().isBlank()) {
        existing.setRole(ROLE_ADMIN);
        existing.setUpdatedAt(LocalDateTime.now());
        appUserMapper.updateById(existing);
      }
      return;
    }

    LocalDateTime now = LocalDateTime.now();
    AppUser admin =
        AppUser.builder()
            .username("admin")
            .displayName("系统管理员")
            .passwordHash(sha256("admin123456"))
            .role(ROLE_ADMIN)
            .createdAt(now)
            .updatedAt(now)
            .build();
    appUserMapper.insert(admin);
  }

  public AppUser requireAdmin(String username) {
    AppUser user = findByUsername(username);
    if (user == null || !ROLE_ADMIN.equalsIgnoreCase(normalizeRole(user.getRole()))) {
      throw new IllegalArgumentException("请使用管理员账号访问后台管理");
    }
    return user;
  }

  public AppUser findByUsername(String username) {
    if (username == null || username.isBlank()) {
      return null;
    }

    return appUserMapper.selectOne(
        (Wrapper<AppUser>)
            new LambdaQueryWrapper<AppUser>().eq(AppUser::getUsername, username.trim()));
  }

  private String normalizeRequestedRole(String requestedRole) {
    String role = normalizeRole(requestedRole);
    return ROLE_ADMIN.equals(role) ? ROLE_ADMIN : ROLE_USER;
  }

  private String normalizeRole(String role) {
    if (role == null || role.isBlank()) {
      return "";
    }
    return role.trim().toUpperCase();
  }

  private String safeTrim(String value) {
    return value == null ? "" : value.trim();
  }

  private String sha256(String value) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] encoded = digest.digest(value.getBytes(StandardCharsets.UTF_8));
      StringBuilder builder = new StringBuilder();
      for (byte current : encoded) {
        builder.append(String.format("%02x", current));
      }
      return builder.toString();
    } catch (Exception ignored) {
      throw new IllegalStateException("密码加密失败");
    }
  }
}
