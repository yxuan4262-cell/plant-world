package com.plantvision.dto;

public record AuthRequest(String username, String displayName, String password, String role) {
  public AuthRequest(String username, String displayName, String password) {
    this(username, displayName, password, "USER");
  }
}
