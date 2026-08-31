import { beforeEach, describe, expect } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { Title } from './Title';

describe('Title test with args', () => {
  const title = 'My title';
  const nextPanelObject = {
    nextPanel: () => undefined,
  };

  const prevPanelObject = {
    prevPanel: () => undefined,
  };

  const nextPanelFunction = vi.spyOn(nextPanelObject, 'nextPanel');
  const prevPanelFunction = vi.spyOn(prevPanelObject, 'prevPanel');

  beforeEach(async () => {
    await render(
      <Title title={title} prevPanel={prevPanelObject.prevPanel} nextPanel={nextPanelObject.nextPanel}>
        <h3>Hola</h3>
      </Title>,
    );
    await expect.element(page.getByText(title)).toBeInTheDocument();
  });

  it('should show title', async () => {
    await expect.element(page.getByText(title)).toBeInTheDocument();
  });

  it('should have prev and next panel buttons', async () => {
    await expect.element(page.getByTitle('Previous panel')).toBeInTheDocument();
    await expect.element(page.getByTitle('Next panel')).toBeInTheDocument();
  });

  it('should show children', async () => {
    await expect.element(page.getByText('Hola')).toBeInTheDocument();
  });

  it('functions should be called', async () => {
    await userEvent.click(page.getByTitle('Next panel'));
    await userEvent.click(page.getByTitle('Previous panel'));

    expect(nextPanelFunction).toHaveBeenCalledOnce();
    expect(prevPanelFunction).toHaveBeenCalledOnce();
  });
});

describe('Title test without args', () => {
  const title = 'My title';

  it('should show title', async () => {
    await render(<Title title={title}></Title>);

    await expect.element(page.getByText(title)).toBeInTheDocument();
  });

  it('should not have prev and next panel button if no functions are defined', async () => {
    const { container } = await render(<Title title={title}></Title>);
    await expect.element(page.getByText(title)).toBeInTheDocument();

    expect(container.getElementsByClassName('p-panel')).toHaveLength(0);
    expect(container.getElementsByClassName('n-panel')).toHaveLength(0);
  });

  it('should not show children neither buttons if not defined', async () => {
    const { container } = await render(<Title title={title}></Title>);
    await expect.element(page.getByText(title)).toBeInTheDocument();
    expect(container.firstChild?.childNodes).toHaveLength(1);
  });
});

describe('Title with children', () => {
  const title = 'My title';

  let children: React.ReactNode[];
  beforeEach(() => {
    const CHILDREN = Math.floor(Math.random() * 10);
    children = new Array(CHILDREN) as React.ReactNode[];
    for (let i = 0; i < CHILDREN; i++) {
      children[i] = <span key={i}>node {i}</span>;
    }
  });

  it('should render title plus children created', async () => {
    const instance = await render(<Title title={title}>{children}</Title>);
    await expect.element(page.getByText(title)).toBeInTheDocument();

    expect(instance.container.firstChild?.childNodes).toHaveLength(children.length + 1);
  });
});
