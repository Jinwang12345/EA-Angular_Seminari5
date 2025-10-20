import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';

export interface User {
  _id: string;
  username: string;
  gmail: string;
  birthday?: string | Date;
  eventos: string[];
}

export interface LoginResponse {
  message: string;
  user: User;
}

export interface RegisterResponse {
  message: string;
  user: User;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:3000/api';
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    const saved = localStorage.getItem('currentUser');
    if (saved) {
      const u: User = JSON.parse(saved);
      this.currentUserSubject.next(u);
    }
  }

  /** LOGIN */
  login(username: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/user/auth/login`, {
      username,
      password
    }).pipe(
      tap(res => this.setCurrentUser(res.user))
    );
  }

  /** REGISTRO (nuevo) */
  register(username: string, gmail: string, password: string, birthday?: string): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.apiUrl}/user/auth/register`, {
      username,
      gmail,
      password,
      birthday
    }).pipe(
      tap(res => this.setCurrentUser(res.user))
    );
  }

  /** Utilidad para sincronizar estado/localStorage */
  private setCurrentUser(user: User | null) {
    if (user) {
      localStorage.setItem('currentUser', JSON.stringify(user));
    } else {
      localStorage.removeItem('currentUser');
    }
    this.currentUserSubject.next(user);
  }

  logout(): void {
    this.setCurrentUser(null);
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  isLoggedIn(): boolean {
    return !!this.currentUserSubject.value;
  }

  // Solo desarrollo
  createAdminUser(): Observable<any> {
    return this.http.post(`${this.apiUrl}/user/auth/create-admin`, {});
  }
}
