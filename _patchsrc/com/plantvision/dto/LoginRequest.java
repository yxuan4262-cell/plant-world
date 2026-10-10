package com.plantvision.dto;

public record LoginRequest(String username, String password, String role) {
  public LoginRequest(String username, String password) {
    this(username, password, "");
  }
}
