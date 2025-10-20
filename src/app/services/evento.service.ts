import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Evento, Participant } from '../models/evento.model';

@Injectable({ providedIn: 'root' })
export class EventoService {
  private apiUrl = 'http://localhost:3000/api/event';

  constructor(private http: HttpClient) {}

  /** Obtener todos los eventos */
  getEventos(): Observable<Evento[]> {
    return this.http.get<Evento[]>(this.apiUrl);
  }

  /** Obtener un evento por ID */
  getEventoById(id: string): Observable<Evento> {
    return this.http.get<Evento>(`${this.apiUrl}/${id}`);
  }

  /** Crear un evento nuevo */
  addEvento(newEvent: Evento): Observable<Evento> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const scheduleAsString =
      Array.isArray(newEvent.schedule) ? (newEvent.schedule[0] || '') : (newEvent.schedule as any);
    const payload: any = {
      ...newEvent,
      schedule: scheduleAsString,
      participantes: [...(newEvent.participantes || [])]
    };
    return this.http.post<Evento>(this.apiUrl, payload, { headers });
  }

  /** Eliminar un evento */
  deleteEvento(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
  
  /** 🔧 Actualizar datos del evento (título, horario, dirección) */
  updateEvento(id: string, data: Partial<Evento>): Observable<Evento> {
    return this.http.patch<Evento>(`${this.apiUrl}/${id}`, data);
  }

  /** Añadir un participante a un evento */
  addParticipante(eventoId: string, participante: Participant): Observable<Evento> {
    return this.http.post<Evento>(`${this.apiUrl}/${eventoId}/participantes`, participante);
  }

  /** Actualizar un participante de un evento */
  updateParticipante(eventoId: string, participanteId: string, data: Partial<Participant>): Observable<Evento> {
    return this.http.patch<Evento>(`${this.apiUrl}/${eventoId}/participantes/${participanteId}`, data);
  }

  /** Eliminar un participante de un evento */
  deleteParticipante(eventoId: string, participanteId: string): Observable<Evento> {
    return this.http.delete<Evento>(`${this.apiUrl}/${eventoId}/participantes/${participanteId}`);
  }
}
