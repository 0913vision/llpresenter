export const legacyMacrosFile = {
  format: 'llsettings.macros',
  schemaVersion: 1,
  future: {enabled: true},
  macros: [
    {
      id: '00000000-0000-4000-8000-000000000020',
      name: 'Legacy macro',
      icon: 'macro',
      color: 'teal',
      legacy: {label: 'Keep this macro'},
      actions: [
        {
          kind: 'look',
          look: '00000000-0000-4000-8000-000000000004',
          transition: {fade: true, durationMs: 500},
          legacy: {targets: ['main'], future: [1, {enabled: false}]},
        },
        {kind: 'clearLayer', layer: 'slide'},
      ],
    },
  ],
  collections: [],
};
