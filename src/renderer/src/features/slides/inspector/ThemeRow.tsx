import {useContext, type JSX} from 'react';
import type {ThemeId} from '@core/schema/ids';
import {withTheme} from '@core/slides';
import {themeOfSlide} from '@core/theme';
import {useThemes} from '@renderer/platform/themes';
import {WorkspaceNavigation} from '@renderer/platform/WorkspaceNavigation';
import {openTheme} from '@renderer/session/themeRequests';
import {Button} from '@renderer/ui/Button';
import {PropertyRow} from '@renderer/ui/PropertyRow';
import {SelectMenu} from '@renderer/ui/SelectMenu';
import {changeSelected, type ChosenSlides} from './changeSelected';
import styles from './SlideInspector.module.css';

/** The theme of the selected slides, among the ones for the same purpose. */
export function ThemeRow({deck, chosen}: ChosenSlides): JSX.Element {
  const themes = useThemes(view => view.themes);
  const navigate = useContext(WorkspaceNavigation);
  const own = chosen.map(slide => themeOfSlide(themes, slide));
  const first = own[0];
  const purposes = new Set(own.map(theme => theme.purpose));
  const mixed = new Set(chosen.map(slide => slide.theme)).size > 1;
  const options =
    purposes.size === 1
      ? (themes?.themes ?? []).filter(theme => purposes.has(theme.purpose))
      : [];
  return (
    <PropertyRow label="테마">
      {({controlId}) => (
        <span className={styles.withAction}>
          <SelectMenu<ThemeId>
            id={controlId}
            aria-label="테마"
            block
            disabled={deck.readOnly || options.length === 0}
            value={mixed ? undefined : first?.id}
            valueText={mixed ? '혼합' : (first?.name ?? '없음')}
            options={options.map(theme => ({
              value: theme.id,
              label: theme.name,
            }))}
            onChange={id => changeSelected(deck, slide => withTheme(slide, id))}
          />
          <Button
            size="md"
            disabled={navigate === undefined || first === undefined}
            onClick={() => {
              if (first === undefined) return;
              openTheme(first.id);
              navigate?.('screens');
            }}
          >
            테마 편집
          </Button>
        </span>
      )}
    </PropertyRow>
  );
}
