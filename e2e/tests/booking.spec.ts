import { expect, test } from '@playwright/test';

test('владелец видит бронирования из каталога и может выбрать email каждого гостя', async ({ page }) => {
  const title = 'Знакомство';
  const anna = {
    name: 'Анна',
    email: 'anna@example.com',
    topic: 'План первой встречи',
    href: 'mailto:anna@example.com',
  };
  const boris = {
    name: 'Борис',
    email: 'boris+booking@example.com',
    topic: 'Обсуждение проекта',
    href: 'mailto:boris%2Bbooking@example.com',
  };
  const mailtoLinks = page.locator('a[href^="mailto:" i]');
  await page.goto('/');
  await page.getByRole('link', { name: 'Владельцу' }).click();
  await expect(page).toHaveURL(/\/owner\/bookings$/);
  await expect(page.getByText('Бронирований пока нет')).toBeVisible();
  await expect(mailtoLinks).toHaveCount(0);
  await page.getByRole('link', { name: 'Типы встреч' }).click();
  await page.getByLabel('Название').fill(title);
  await page.getByLabel('Описание').fill('Первая встреча');
  await page.getByLabel('Длительность').selectOption('30');
  await page.getByRole('button', { name: 'Создать' }).click();
  await expect(page.getByText('Тип встречи создан')).toBeVisible();

  await page.getByRole('link', { name: 'Запись на звонок' }).click();
  await page.getByRole('link', { name: 'Записаться', exact: true }).first().click();
  async function bookGuest({ name, email, topic }: { name: string; email: string; topic: string }) {
    await page.getByRole('link', { name: title }).click();
    const days = page.getByRole('group', { name: 'Дни для записи' });
    const slot = page.getByRole('group', { name: 'Время начала' }).getByRole('button').first();
    async function selectFirstSlot() {
      await days.getByRole('button', { disabled: false }).first().click();
      const start = await slot.innerText();
      await slot.click();
      return start;
    }
    let time = await selectFirstSlot();
    await page.getByLabel('Имя').fill(name);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Тема разговора').fill(topic);
    await page.getByRole('button', { name: 'Забронировать' }).click();
    const confirmed = page.getByRole('heading', { name: 'Бронирование подтверждено' });
    const expired = page.getByText('Это время больше недоступно. Выберите другое.', { exact: true });
    await expect(confirmed.or(expired)).toBeVisible();
    if (await expired.isVisible()) {
      time = await selectFirstSlot();
      await expect(page.getByLabel('Имя')).toHaveValue(name);
      await expect(page.getByLabel('Email')).toHaveValue(email);
      await page.getByRole('button', { name: 'Забронировать' }).click();
    }
    await expect(confirmed).toBeVisible();
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await expect(page.getByText(email, { exact: true })).toBeVisible();
    return page.getByText(time, { exact: false }).innerText();
  }

  const annaDateAndTime = await bookGuest(anna);
  await page.getByRole('link', { name: 'Записаться ещё' }).click();
  const borisDateAndTime = await bookGuest(boris);

  await page.getByRole('link', { name: 'Владельцу' }).click();
  for (const { name, email, topic, href, dateAndTime } of [
    { ...anna, dateAndTime: annaDateAndTime },
    { ...boris, dateAndTime: borisDateAndTime },
  ]) {
    const booking = page.getByRole('article').filter({ has: page.getByText(name, { exact: true }) });
    await expect(booking.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(booking.getByText(dateAndTime, { exact: true })).toBeVisible();
    await expect(booking.getByText(topic, { exact: false })).toBeVisible();
    const emailLink = booking.getByRole('link', { name: email, exact: true });
    await expect(emailLink).toBeVisible();
    await expect(emailLink).toHaveText(email);
    await expect(emailLink).toHaveAttribute('href', href);
  }

  await expect(mailtoLinks).toHaveCount(2);
  await page.getByRole('link', { name: 'Типы встреч' }).focus();
  await page.keyboard.press('Tab');
  await expect(mailtoLinks.first()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(mailtoLinks.last()).toBeFocused();
});
