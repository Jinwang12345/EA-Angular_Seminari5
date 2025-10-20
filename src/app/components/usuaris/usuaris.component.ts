import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { User } from '../../models/user.model';
import { UserService } from '../../services/user.service';
import { TruncatePipe } from '../../pipes/truncate.pipe';
import { MaskEmailPipe } from '../../pipes/maskEmail.pipe';
import { Evento } from '../../models/evento.model';
import { EventoService } from '../../services/evento.service';
import { Location } from '@angular/common';
import { DynamicTableComponent, TableColumn } from '../table/table.component';

@Component({
  selector: 'app-usuaris',
  templateUrl: './usuaris.component.html',
  styleUrls: ['./usuaris.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule, TruncatePipe, MaskEmailPipe, DynamicTableComponent]
})
export class UsuarisComponent implements OnInit {
  usuarios: User[] = [];
  desplegado: boolean[] = [];
  mostrarPassword: boolean[] = [];

  showTableView: boolean = false;
  tableColumns: TableColumn[] = [
    { key: 'username', label: 'Nombre de Usuario', sortable: true },
    { key: 'gmail', label: 'Email', sortable: true },
    { key: 'birthday', label: 'Cumpleaños', sortable: true, type: 'date' },
    { key: 'eventCount', label: 'Nº Eventos', sortable: true },
    { key: 'actions', label: 'Acciones', type: 'actions' }
  ];

  nuevoUsuario: User = {
    username: '',
    gmail: '',
    password: '',
    birthday: new Date(),
    eventos: []
  };

  birthdayStr: string = this.todayISO();
  confirmarPassword: string = '';
  usuarioEdicion: User | null = null;
  indiceEdicion: number | null = null;
  formSubmitted = false;

  showDeleteModal = false;
  private pendingDeleteIndex: number | null = null;

  showUpdateModal = false;
  private pendingUpdateUser: User | null = null;
  private pendingUpdateIndex: number | null = null;

  page = 1;
  pageSize = 6;

  todosEventos: Evento[] = [];
  private eventosById = new Map<string, Evento>();

  constructor(
    private userService: UserService,
    private eventoService: EventoService,
    private location: Location
  ) {}

  ngOnInit(): void {
    this.eventoService.getEventos().subscribe({
      next: (evts) => {
        this.todosEventos = evts.map(e => ({
          ...e,
          // Elimina esta conversión a array - schedule ya es string
          participantes: Array.isArray((e as any).participantes) ? (e as any).participantes : ((e as any).participants || [])
        }));
        this.eventosById.clear();
        this.todosEventos.forEach(e => { if (e._id) this.eventosById.set(e._id, e); });
      }
    });

    this.userService.getUsers().subscribe(data => {
      this.usuarios = data.map(u => ({
        ...u,
        birthday: new Date(u.birthday as unknown as string)
      }));
      this.desplegado = new Array(this.usuarios.length).fill(false);
      this.mostrarPassword = new Array(this.usuarios.length).fill(false);
      this.clampPage();
    });
  }

  toggleTableView(): void {
    this.showTableView = !this.showTableView;
  }

  get usuariosForTable(): any[] {
    return this.usuarios.map(usuario => ({
      ...usuario,
      eventCount: this.getUserEvents(usuario).length,
      birthday: new Date(usuario.birthday)
    }));
  }

  onTableEdit(user: any): void {
    const index = this.usuarios.findIndex(u => u._id === user._id);
    if (index !== -1) {
      this.prepararEdicion(this.usuarios[index], index);
      document.querySelector('.form-container')?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  onTableDelete(user: any): void {
    const index = this.usuarios.findIndex(u => u._id === user._id);
    if (index !== -1) {
      this.openDeleteModal(index);
    }
  }

  exportTable(): void {
    const csvContent = this.convertToCSV(this.usuariosForTable);
    this.downloadCSV(csvContent, 'usuarios.csv');
  }

  private convertToCSV(data: any[]): string {
    const headers = ['Nombre de Usuario', 'Email', 'Cumpleaños', 'Nº Eventos'];
    const csvRows = [headers.join(',')];
    
    data.forEach(row => {
      const values = [
        `"${row.username}"`,
        `"${row.gmail}"`,
        `"${new Date(row.birthday).toLocaleDateString()}"`,
        row.eventCount
      ];
      csvRows.push(values.join(','));
    });
    
    return csvRows.join('\n');
  }

  private downloadCSV(csvContent: string, filename: string): void {
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  goHome(): void { this.location.back(); }

  agregarElemento(userForm: NgForm): void {
    this.formSubmitted = true;

    if (userForm.invalid) return;
    if (this.nuevoUsuario.password !== this.confirmarPassword) return;
    if (this.isFutureBirthday(this.birthdayStr)) return;

    const birthdayDate = this.parseAsUTCDate(this.birthdayStr);

    if (this.indiceEdicion !== null) {
      const actualizado: User = {
        ...this.nuevoUsuario,
        birthday: birthdayDate,
        _id: this.usuarios[this.indiceEdicion]._id
      };
      this.pendingUpdateUser = actualizado;
      this.pendingUpdateIndex = this.indiceEdicion;
      this.showUpdateModal = true;
      return;
    }

    const usuarioJSON: User = {
      username: this.nuevoUsuario.username,
      gmail: this.nuevoUsuario.gmail,
      password: this.nuevoUsuario.password,
      birthday: birthdayDate,
      eventos: this.nuevoUsuario.eventos ?? []
    };

    this.userService.addUser(usuarioJSON).subscribe(response => {
      this.usuarios.push({
        ...usuarioJSON,
        _id: response._id,
        eventos: response.eventos ?? usuarioJSON.eventos
      });
      this.desplegado.push(false);
      this.mostrarPassword.push(false);
      this.clampPage();
      userForm.resetForm();
      this.resetFormInternal();
    });
  }

  confirmarUpdate(): void {
    if (this.pendingUpdateUser == null || this.pendingUpdateIndex == null) {
      this.closeUpdateModal();
      return;
    }
    const idx = this.pendingUpdateIndex;
    this.userService.updateUser(this.pendingUpdateUser).subscribe(response => {
      this.usuarios[idx] = { ...(response as User) };
      this.closeUpdateModal();
      this.resetFormInternal();
      this.clampPage();
    });
  }

  closeUpdateModal(): void {
    this.showUpdateModal = false;
    this.pendingUpdateUser = null;
    this.pendingUpdateIndex = null;
  }

  openDeleteModal(index: number): void {
    this.pendingDeleteIndex = index;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.pendingDeleteIndex = null;
    this.showDeleteModal = false;
  }

  confirmarEliminar(): void {
    if (this.pendingDeleteIndex == null) {
      this.closeDeleteModal();
      return;
    }
    const idx = this.pendingDeleteIndex;
    const usuarioAEliminar = this.usuarios[idx];

    if (!usuarioAEliminar._id) {
      alert('El usuario no se puede eliminar porque no está registrado en la base de datos.');
      this.closeDeleteModal();
      return;
    }

    this.userService.deleteUserById(usuarioAEliminar._id).subscribe(
      () => {
        this.usuarios.splice(idx, 1);
        this.desplegado.splice(idx, 1);
        this.mostrarPassword.splice(idx, 1);
        this.clampPage();
        this.closeDeleteModal();
      },
      () => {
        alert('Error al eliminar el usuario. Por favor, inténtalo de nuevo.');
        this.closeDeleteModal();
      }
    );
  }

  cancelarEdicion(userForm: NgForm): void {
    this.indiceEdicion = null;
    this.usuarioEdicion = null;
    userForm.resetForm();
    this.resetFormInternal();
  }

  private resetFormInternal(): void {
    this.nuevoUsuario = {
      username: '',
      gmail: '',
      password: '',
      birthday: new Date(),
      eventos: []
    };
    this.birthdayStr = this.todayISO();
    this.confirmarPassword = '';
    this.formSubmitted = false;
    this.indiceEdicion = null;
  }

  prepararEdicion(usuario: User, index: number): void {
    this.usuarioEdicion = { ...usuario };
    this.nuevoUsuario = { ...usuario };
    this.indiceEdicion = index;

    this.desplegado = this.desplegado.map((_, i) => i === index);
    this.birthdayStr = this.toISODate(new Date(usuario.birthday));
  }

  toggleDesplegable(index: number): void {
    const willOpen = !this.desplegado[index];
    this.desplegado = this.desplegado.map((_, i) => i === index ? willOpen : false);
  }

  togglePassword(index: number): void {
    this.mostrarPassword[index] = !this.mostrarPassword[index];
  }

  private userEventIds(u: User): string[] {
    return (u.eventos ?? []).map(e => typeof e === 'string' ? e : (e._id ?? '')).filter(Boolean) as string[];
  }

  getUserEvents(u: User): Evento[] {
    const ids = new Set(this.userEventIds(u));
    return this.todosEventos.filter(ev => ev._id && ids.has(ev._id));
  }

  getUserEventNames(u: User): string {
    const names = this.getUserEvents(u).map(e => e.name).filter(Boolean);
    return names.length ? names.join(', ') : '-';
  }

  getAvailableEvents(u: User): Evento[] {
    const ids = new Set(this.userEventIds(u));
    return this.todosEventos.filter(ev => ev._id && !ids.has(ev._id));
  }

  onAddEvent(u: User, ev: Evento): void {
    if (!u._id || !ev._id) return;
    this.userService.addEventToUser(u._id, ev._id).subscribe({
      next: (updated) => {
        const idx = this.usuarios.findIndex(x => x._id === updated._id);
        if (idx >= 0) {
          const current = this.usuarios[idx];
          const currentIds = this.userEventIds(current);
          if (!currentIds.includes(ev._id!)) {
            current.eventos = [...(current.eventos ?? []), ev._id!];
          }
        }
      },
      error: () => alert('No se pudo añadir el usuario a ese evento.')
    });
  }

  get pagedUsuarios(): User[] {
    const start = (this.page - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.usuarios.slice(start, end);
  }
  get totalPages(): number {
    return Math.max(1, Math.ceil(this.usuarios.length / this.pageSize));
  }
  setPageSize(v: string): void {
    const n = parseInt(v, 10) || 6;
    this.pageSize = n;
    this.page = 1;
    this.clampPage();
  }
  prevPage(): void { if (this.page > 1) this.page--; }
  nextPage(): void { if (this.page < this.totalPages) this.page++; }
  idx(i: number): number { return (this.page - 1) * this.pageSize + i; }
  private clampPage(): void {
    this.page = Math.min(Math.max(1, this.page), this.totalPages);
  }

  private todayISO(): string {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }
  private toISODate(d: Date): string {
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
      .toISOString()
      .slice(0, 10);
  }
  private parseAsUTCDate(ymd: string): Date {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  private todayUTC(): Date {
    const t = new Date();
    return new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()));
  }
  isFutureBirthday(ymd: string): boolean {
    if (!ymd) return false;
    return this.parseAsUTCDate(ymd) > this.todayUTC();
  }

  isEvento(e: string | Evento): e is Evento {
    return !!e && typeof e === 'object' && 'name' in e && 'schedule' in e;
  }
}