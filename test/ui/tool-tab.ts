import type {Page} from 'playwright-core';

export async function openToolTab(page: Page, name: string): Promise<void> {
  const panel = page.getByRole('region', {name: '진행 도구', exact: true});
  await panel.waitFor({state: 'visible'});
  const tab = panel.getByRole('tab', {name, exact: true});
  if (await tab.isVisible()) {
    await tab.click();
    return;
  }
  await panel.getByRole('button', {name: '더 보기', exact: true}).click();
  await page
    .getByRole('menu', {name: '더 보기', exact: true})
    .getByRole('menuitemradio', {name, exact: true})
    .click();
}
