import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Evento } from '../../models/evento.model';
import { EventoService } from '../../services/evento.service';
import { UserService } from '../../services/user.service';
import { User } from '../../models/user.model';
import { Location } from '@angular/common';
import { forkJoin, of } from 'rxjs';

type NewEventoVM = {
  name: string;
  schedule: string;        // la API espera string
  address: string;
  participantes: string[]; // enviamos sólo IDs de usuario
};

@Component({
  selector: 'app-evento',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './evento.component.html',
  styleUrls: ['./evento.component.css']
})
export class EventoComponent implements OnInit {
  // ====== estado principal ======
  eventos: Evento[] = [];
  users: User[] = [];
  availableUsers: User[] = [];
  selectedUsers: User[] = [];
  newEvent: NewEventoVM = { name: '', schedule: '', address: '', participantes: [] };

  // edición
  editing = false;
  editingId: string | null = null;
  private originalParticipantMap = new Map<string, string>(); // userId -> participanteSubdocId

  // ui
  dateStr = '';
  timeStr = '';
  errorMessage = '';
  showDeleteModal = false;
  private pendingDeleteIndex: number | null = null;

  // confirmación de actualización
  showUpdateModal = false;
  private pendingUpdateId: string | null = null;
  private pendingUpdateBody: Partial<Evento> | null = null;
  private pendingToAdd: string[] = [];
  private pendingToRemove: Array<{ userId: string; participanteId: string }> = [];

  // paginación
  availablePage = 1;
  availablePageSize = 5;
  selectedPage = 1;
  selectedPageSize = 5;


  constructor(
    private eventoService: EventoService,
    private userService: UserService,
    private location: Location
  ) {}

  ngOnInit(): void {
    this.userService.getUsers().subscribe({
      next: (users) => {
        this.users = users as any;
        this.availableUsers = [...this.users];
        this.clampPages();
      }
    });

    this.eventoService.getEventos().subscribe({
      next: (evts) => { this.eventos = evts; }
    });
  }

  // ====== navegación ======
  goHome(): void {
    this.location.back();
  }

  // ====== horario ======
  setSchedule(): void {
    this.errorMessage = '';
    if (!this.dateStr || !this.timeStr) {
      this.errorMessage = 'Selecciona fecha y hora.';
      return;
    }
    this.newEvent.schedule = `${this.dateStr} ${this.timeStr}`;
  }

  clearSchedule(): void {
    this.newEvent.schedule = '';
    this.dateStr = '';
    this.timeStr = '';
  }

  // ====== participantes (selección UI) ======
  addParticipant(u: User): void {
    if (!u?._id) return;
    this.availableUsers = this.availableUsers.filter(x => x._id !== u._id);
    if (!this.selectedUsers.find(x => x._id === u._id)) this.selectedUsers.push(u);
    this.syncParticipantsIds();
    this.clampPages();
  }

  removeParticipant(u: User): void {
    if (!u?._id) return;
    this.selectedUsers = this.selectedUsers.filter(x => x._id !== u._id);
    if (!this.availableUsers.find(x => x._id === u._id)) {
      this.availableUsers.push(u);
      this.availableUsers.sort((a, b) => a.username.localeCompare(b.username));
    }
    this.syncParticipantsIds();
    this.clampPages();
  }

  private syncParticipantsIds(): void {
    this.newEvent.participantes = this.selectedUsers.map(u => u._id!).filter(Boolean);
  }

  // ====== crear/editar ======
  onSubmit(): void {
    this.errorMessage = '';
    if (!this.newEvent.name?.trim()) {
      this.errorMessage = 'El título del evento es obligatorio.';
      return;
    }
    if (!this.newEvent.schedule?.length) {
      this.errorMessage = 'Selecciona el horario del evento.';
      return;
    }
    if (!this.newEvent.address?.length) {
      this.errorMessage = 'Selecciona la dirección del evento.';
      return;
    }

    // CREAR
    if (!this.editingId) {
      this.eventoService.addEvento(this.newEvent as any).subscribe({
        next: (created) => {
          this.eventos.push(created);
          this.resetForm();
        },
        error: () => {
          this.errorMessage = 'Error al crear el evento. Revisa los datos.';
        }
      });
      return;
    }

    // EDITAR
    const id = this.editingId;

    // 1) actualizar campos básicos
    // preparar confirmación de actualización como en usuarios
    const baseChanges: Partial<Evento> = {
      name: this.newEvent.name,
      schedule: this.newEvent.schedule,
      address: this.newEvent.address
    } as any;
    const selectedIds = new Set(this.newEvent.participantes);
    const originalIds = new Set([...this.originalParticipantMap.keys()]);
    const toAdd = [...selectedIds].filter(x => !originalIds.has(x));
    const toRemove = [...originalIds].filter(x => !selectedIds.has(x));

    this.pendingUpdateId = id;
    this.pendingUpdateBody = baseChanges;
    this.pendingToAdd = toAdd;
    this.pendingToRemove = toRemove.map(userId => ({ userId, participanteId: this.originalParticipantMap.get(userId)! }));
    this.showUpdateModal = true;

    this.eventoService.updateEvento(id, {
      name: this.newEvent.name,
      schedule: this.newEvent.schedule,
      address: this.newEvent.address
    } as any).subscribe({
      next: () => {
        // 2) sincronizar altas/bajas de participantes
        const selectedIds = new Set(this.newEvent.participantes); // userIds actuales
        const originalIds = new Set([...this.originalParticipantMap.keys()]);

        const toAdd = [...selectedIds].filter(x => !originalIds.has(x));
        const toRemove = [...originalIds].filter(x => !selectedIds.has(x));

        const ops: Array<Promise<any>> = [];

        for (const userId of toAdd) {
          ops.push(this.eventoService.addParticipante(id, { usuario: userId }).toPromise());
        }
        for (const userId of toRemove) {
          const participanteId = this.originalParticipantMap.get(userId)!;
          ops.push(this.eventoService.deleteParticipante(id, participanteId).toPromise());
        }

        Promise.all(ops).then(() => {
          // recargar lista y salir de edición
          this.eventoService.getEventos().subscribe({
            next: (evts) => {
              this.eventos = evts;
              this.cancelEdit();
            },
            error: () => this.cancelEdit()
          });
        }).catch(() => {
          this.errorMessage = 'Se actualizó el evento, pero hubo un problema al sincronizar participantes.';
        });
      },
      error: () => {
        this.errorMessage = 'Error al actualizar el evento.';
      }
    });
  }

  startEdit(i: number): void {
    const e = this.eventos[i];
    if (!e?._id) return;

    this.editing = true;
    this.editingId = e._id;
    this.errorMessage = '';

    // formulario con valores actuales
    this.newEvent.name = e.name || '';
    this.newEvent.address = (e as any).address || '';
    this.newEvent.schedule = (e as any).schedule || '';

    // date/time visibles
    if (this.newEvent.schedule) {
      const sep = this.newEvent.schedule.includes('T') ? 'T' : ' ';
      const [d, t = ''] = this.newEvent.schedule.split(sep);
      this.dateStr = d || '';
      this.timeStr = t.slice(0, 5) || '';
    } else {
      this.dateStr = '';
      this.timeStr = '';
    }

    // mapa original userId -> participanteSubdocId
    this.originalParticipantMap.clear();
    const list = Array.isArray((e as any).participantes) ? (e as any).participantes : [];
    for (const p of list) {
      const userId = this.resolveUserIdFromParticipant(p);
      const partId = this.resolveParticipantSubdocId(p);
      if (userId && partId) this.originalParticipantMap.set(userId, partId);
    }
    

    // participantes seleccionados / disponibles
    const idsInEvent = list
      .map((p: any) => this.resolveUserIdFromParticipant(p))
      .filter(Boolean) as string[];

    this.selectedUsers  = this.users.filter(u => idsInEvent.includes(u._id!));
    this.availableUsers = this.users.filter(u => !idsInEvent.includes(u._id!));

    this.syncParticipantsIds();
    this.clampPages();
  }

  cancelEdit(): void {
    this.editing = false;
    this.editingId = null;
    this.originalParticipantMap.clear();
    this.resetForm();
  }

  // ====== confirmación actualización ======
  closeUpdateModal(): void {
    this.showUpdateModal = false;
    this.pendingUpdateId = null;
    this.pendingUpdateBody = null;
    this.pendingToAdd = [];
    this.pendingToRemove = [];
  }

  confirmarUpdate(): void {
    if (!this.pendingUpdateId || !this.pendingUpdateBody) {
      this.closeUpdateModal();
      return;
    }

    const id = this.pendingUpdateId;
    const body = this.pendingUpdateBody;

    this.eventoService.updateEvento(id, body as any).subscribe({
      next: () => {
        const ops$ = [] as Array<import('rxjs').Observable<any>>;
        for (const userId of this.pendingToAdd) {
          ops$.push(this.eventoService.addParticipante(id, { usuario: userId }));
        }
        for (const rem of this.pendingToRemove) {
          ops$.push(this.eventoService.deleteParticipante(id, rem.participanteId));
        }

        const batch$ = (ops$.length ? forkJoin(ops$) : of(null)) as import('rxjs').Observable<any>;
        batch$.subscribe({
          next: () => {
            this.eventoService.getEventos().subscribe({
              next: (evts) => {
                this.eventos = evts;
                this.closeUpdateModal();
                this.cancelEdit();
              },
              error: () => {
                this.closeUpdateModal();
                this.cancelEdit();
              }
            });
          },
          error: () => {
            this.errorMessage = 'Se actualizó el evento, pero hubo un problema al sincronizar participantes.';
            this.closeUpdateModal();
          }
        });
      },
      error: () => {
        this.errorMessage = 'Error al actualizar el evento.';
        this.closeUpdateModal();
      }
    });
  }

  // ====== helpers de participantes ======
  private resolveUserIdFromParticipant(p: any): string | null {
    if (!p) return null;
    if (typeof p === 'string') return p;           // era sólo un ID
    if (p.usuario) return p.usuario;               // subdocumento { usuario, ... }
    if (p._id && typeof p._id === 'string') return p._id; // fallback
    return null;
  }
  

  /** _id del subdocumento participante si existe */
  private resolveParticipantSubdocId(p: any): string | null {
    if (!p) return null;
    if (typeof p === 'object' && p._id && typeof p._id === 'string') return p._id;
    return null;
  }
  
  get schedulePreview(): string {
  const s: any = this.newEvent?.schedule;
  return typeof s === 'string' ? s : (Array.isArray(s) ? (s[0] || '') : '');
}

  // ====== eliminar ======
  openDeleteModal(index: number): void {
    this.pendingDeleteIndex = index;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.pendingDeleteIndex = null;
  }

  confirmarEliminar(): void {
    if (this.pendingDeleteIndex == null) {
      this.closeDeleteModal();
      return;
    }
    const idx = this.pendingDeleteIndex;
    const evt = this.eventos[idx];
    if (!evt?._id) {
      this.closeDeleteModal();
      return;
    }
    this.eventoService.deleteEvento(evt._id).subscribe({
      next: () => {
        this.eventos.splice(idx, 1);
        this.closeDeleteModal();
      },
      error: () => {
        this.errorMessage = 'Error al eliminar el evento.';
        this.closeDeleteModal();
      }
    });
  }

  // ====== visual ======
  getScheduleText(e: Evento): string {
    return this.formatSchedule(e?.schedule as any);
  }

  formatSchedule(s: string | undefined | null): string {
    if (!s) return '-';
    const sep = s.includes('T') ? 'T' : ' ';
    const [d, t = ''] = s.split(sep);
    const [y, m, d2] = d.split('-');
    const hhmm = t.slice(0, 5);
    if (y && m && d2) return `${d2}-${m}-${y}${hhmm ? ' ' + hhmm : ''}`;
    return s;
  }

  getEventAddress(e: any): string {
    return e?.address ?? e?.direccion ?? '-';
  }

  getParticipantsList(e: any): any[] {
    return Array.isArray(e?.participantes) ? e.participantes : [];
  }

  getParticipantsNames(e: any): string {
    const arr = this.getParticipantsList(e);
    const names = arr
      .map(p => this.resolveUserIdFromParticipant(p))
      .filter(Boolean)
      .map(id => this.getUserNameById(id as string))
      .filter(Boolean);
    return names.length ? names.join(', ') : '-';
  }

  getUserNameById(userId: string): string {
    const u = this.users.find(x => x._id === userId);
    return u ? u.username : userId;
  }

  // ====== paginación ======
  get availableTotalPages(): number {
    return Math.max(1, Math.ceil(this.availableUsers.length / this.availablePageSize));
  }

  get selectedTotalPages(): number {
    return Math.max(1, Math.ceil(this.selectedUsers.length / this.selectedPageSize));
  }

  get availablePageItems(): User[] {
    const start = (this.availablePage - 1) * this.availablePageSize;
    return this.availableUsers.slice(start, start + this.availablePageSize);
  }

  get selectedPageItems(): User[] {
    const start = (this.selectedPage - 1) * this.selectedPageSize;
    return this.selectedUsers.slice(start, start + this.selectedPageSize);
  }
    

  availablePrevPage(): void {
    if (this.availablePage > 1) this.availablePage--;
  }
  availableNextPage(): void {
    if (this.availablePage < this.availableTotalPages) this.availablePage++;
  }
  setAvailablePageSize(v: string): void {
    const n = parseInt(v, 10) || 5;
    this.availablePageSize = n;
    this.availablePage = 1;
    this.clampPages();
  }

  selectedPrevPage(): void {
    if (this.selectedPage > 1) this.selectedPage--;
  }
  selectedNextPage(): void {
    if (this.selectedPage < this.selectedTotalPages) this.selectedPage++;
  }
  setSelectedPageSize(v: string): void {
    const n = parseInt(v, 10) || 5;
    this.selectedPageSize = n;
    this.selectedPage = 1;
    this.clampPages();
  }

  private clampPages(): void {
    this.availablePage = Math.min(Math.max(1, this.availablePage), this.availableTotalPages);
    this.selectedPage = Math.min(Math.max(1, this.selectedPage), this.selectedTotalPages);
  }

  private resetForm(): void {
    this.newEvent = { name: '', schedule: '', address: '', participantes: [] };
    this.availableUsers = [...this.users];
    this.selectedUsers = [];
    this.dateStr = '';
    this.timeStr = '';
    this.errorMessage = '';
    this.editing = false;
    this.editingId = null;
    this.originalParticipantMap.clear();
    this.availablePage = 1;
    this.selectedPage = 1;
    this.clampPages();
  }
}
