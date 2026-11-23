import { Anchor, Box, Container, Group, Stack } from '@mantine/core';
import { lazy, Suspense } from 'react';
import { Link, Navigate, Outlet, Route, Routes } from 'react-router';

import { CatalogPage } from './pages/CatalogPage';
import { HomePage } from './pages/HomePage';

import { NotFoundPage } from './pages/NotFoundPage';
import { OwnerBookingsPage } from './pages/OwnerBookingsPage';
import { paths } from './paths';

const MeetingTypePage = lazy(() =>
  import('./pages/MeetingTypePage').then((module) => ({ default: module.MeetingTypePage })),
);
const OwnerMeetingTypesPage = lazy(() =>
  import('./pages/OwnerMeetingTypesPage').then((module) => ({
    default: module.OwnerMeetingTypesPage,
  })),
);

function Layout() {
  return (
    <>
      <Box
        component="header"
        py="md"
        style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
      >
        <Container size="sm">
          <Group justify="space-between">
            <Anchor component={Link} to={paths.home} fw={700} underline="never">
              Запись на звонок
            </Anchor>
            <Anchor component={Link} to={paths.owner}>
              Владельцу
            </Anchor>
          </Group>
        </Container>
      </Box>
      <Container component="main" size="sm" py="xl">
        <Suspense fallback={<span role="status">Загрузка…</span>}>
          <Outlet />
        </Suspense>
      </Container>
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path={paths.catalog} element={<CatalogPage />} />
        <Route path={paths.meetingType(':meetingTypeId')} element={<MeetingTypePage />} />

        <Route path={paths.owner} element={<OwnerLayout />}>
          <Route index element={<Navigate replace to={paths.ownerBookings} />} />
          <Route path={paths.ownerBookings} element={<OwnerBookingsPage />} />
          <Route path={paths.ownerMeetingTypes} element={<OwnerMeetingTypesPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

function OwnerLayout() {
  return (
    <Stack>
      <Group component="nav" aria-label="Разделы владельца">
        <Anchor component={Link} to={paths.ownerBookings}>
          Бронирования
        </Anchor>
        <Anchor component={Link} to={paths.ownerMeetingTypes}>
          Типы встреч
        </Anchor>
      </Group>
      <Outlet />
    </Stack>
  );
}
