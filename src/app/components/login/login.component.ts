import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router , RouterModule} from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent  {
  loginForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  private starInterval: any;
  private cometInterval: any;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(4)]]
    });
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';

      const { username, password } = this.loginForm.value;

      this.authService.login(username, password)
        .pipe(finalize(() => this.isLoading = false))
        .subscribe({
          next: (response) => {
            console.log('Login exitoso:', response);
            this.router.navigate(['/home']);
          },
          error: (error) => {
            console.error('Error en login:', error);
            this.errorMessage = error.error?.message || 'Error al iniciar sesión. Verifica tus credenciales.';
          }
        });
    } else {
      this.markFormGroupTouched();
    }
  }

  createAdmin(): void {
    this.authService.createAdminUser().subscribe({
      next: (response) => {
        console.log('Admin creado:', response);
        alert('Usuario admin creado exitosamente. Ahora puedes iniciar sesión con usuario: "admin" y contraseña: "admin"');
        
        this.loginForm.patchValue({
          username: 'admin',
          password: 'admin'
        });
      },
      error: (error) => {
        console.error('Error creando admin:', error);
        this.errorMessage = 'Error creando usuario admin';
      }
    });
  }

  private markFormGroupTouched(): void {
    Object.keys(this.loginForm.controls).forEach(key => {
      this.loginForm.get(key)?.markAsTouched();
    });
  }

  get username() { return this.loginForm.get('username'); }
  get password() { return this.loginForm.get('password'); }
}