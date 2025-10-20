import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  registerData = {
    username: '',
    gmail: '',
    password: '',
    confirmPassword: ''
  };

  errorMessage = '';
  successMessage = '';
  isLoading = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  onRegister(): void {
    this.errorMessage = '';
    this.successMessage = '';

    // Validaciones
    if (!this.registerData.username.trim()) {
      this.errorMessage = 'El nombre de usuario es obligatorio';
      return;
    }

    if (!this.registerData.gmail.trim()) {
      this.errorMessage = 'El correo electrónico es obligatorio';
      return;
    }

    // Validación de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.registerData.gmail)) {
      this.errorMessage = 'El correo electrónico no es válido';
      return;
    }

    if (!this.registerData.password) {
      this.errorMessage = 'La contraseña es obligatoria';
      return;
    }

    if (this.registerData.password.length < 6) {
      this.errorMessage = 'La contraseña debe tener al menos 6 caracteres';
      return;
    }

    if (this.registerData.password !== this.registerData.confirmPassword) {
      this.errorMessage = 'Las contraseñas no coinciden';
      return;
    }

    // Llamar al servicio de registro
    this.isLoading = true;

    this.authService.register(
      this.registerData.username,
      this.registerData.gmail,
      this.registerData.password,
      new Date().toISOString()
    ).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.successMessage = '¡Registro exitoso! Redirigiendo al home...';
        
        // Redirigir al home después de 2 segundos
        setTimeout(() => {
          this.router.navigate(['/home']);
        }, 2000);
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error.error?.message || 'Error al registrar el usuario. Intenta de nuevo.';
      }
    });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}