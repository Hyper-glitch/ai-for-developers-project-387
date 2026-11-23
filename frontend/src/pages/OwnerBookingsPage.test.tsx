import { screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { listBookings, listMeetingTypes } from '../api';
import { renderAt } from '../test/render';

vi.mock('../api', () => ({ listBookings: vi.fn(), listMeetingTypes: vi.fn() }));

it('переходит из шапки к пустому списку владельца', async () => {
  vi.mocked(listBookings).mockResolvedValue([]);
  vi.mocked(listMeetingTypes).mockResolvedValue([]);
  const { user } = renderAt('/');
  const link = screen.getByRole('link', { name: 'Владельцу' });
  expect(link).toHaveAttribute('href', '/owner');
  await user.click(link);
  expect(await screen.findByText('Бронирований пока нет')).toBeInTheDocument();
});

it('показывает московские дату и время, тип и контакты гостя', async () => {
  vi.mocked(listBookings).mockResolvedValue([
    {
      id: 'booking',
      meetingTypeId: 'intro',
      startAt: '2026-11-03T21:15:00Z',
      endAt: '2026-11-03T21:45:00Z',
      guestName: 'Анна',
      guestEmail: 'anna@example.com',
      topic: 'План встречи',
    },
    {
      id: 'another',
      meetingTypeId: 'intro',
      startAt: '2026-11-04T09:00:00Z',
      endAt: '2026-11-04T09:30:00Z',
      guestName: 'Иван',
      guestEmail: 'ivan@example.com',
    },
  ]);
  vi.mocked(listMeetingTypes).mockResolvedValue([
    { id: 'other', title: 'Собеседование', description: '', durationMinutes: 60 },
    { id: 'intro', title: 'Знакомство', description: '', durationMinutes: 30 },
  ]);
  renderAt('/owner/bookings');
  const [first, second] = await screen.findAllByRole('article');
  expect(within(first).getByRole('heading', { name: 'Знакомство' })).toBeVisible();
  expect(within(first).getByText('Тема разговора: План встречи')).toBeVisible();
  expect(within(second).queryByText(/Тема разговора/)).toBeNull();
  expect(screen.getByText(/4 ноября.*00:15/)).toBeInTheDocument();
  expect(screen.getByText('Анна')).toBeInTheDocument();
  expect(screen.getByText('anna@example.com')).toBeInTheDocument();
});
