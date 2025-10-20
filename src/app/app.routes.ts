import { RouterModule, Routes } from '@angular/router';
import { NgModule } from '@angular/core';
import { UsuarisComponent } from './components/usuaris/usuaris.component';
import { EventoComponent } from './components/evento/evento.component';
import { HomeComponent } from './components/home/home.component';
import { authGuard } from './guards/auth.guard';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';


export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { 
    path: '', 
    redirectTo: 'login', 
    pathMatch: 'full' 
  },
  { 
    path: 'home', 
    component: HomeComponent,
    canActivate: [authGuard] 
  },
  { 
    path: 'usuaris', 
    component: UsuarisComponent,
    canActivate: [authGuard] 
  },
  { 
    path: 'evento', 
    component: EventoComponent,
    canActivate: [authGuard] 
  },
  { 
    path: '**', 
    redirectTo: 'login' 
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true })],
  exports: [RouterModule]
})
export class AppRoutingModule { }