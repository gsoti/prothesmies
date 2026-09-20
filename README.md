# prothesmies

Deterministic Greek civil and administrative legal deadline calculators.

```ts
import {
  CourtType,
  ProcedureType,
  getAdminDeadlines,
} from 'prothesmies';

const deadlines = getAdminDeadlines({
  court_type: CourtType.DP_DE,
  procedure_type: ProcedureType.DIAFORA_OUSIAS,
  dikasimos: '2026-11-20',
  syntmisi: false,
});
```

`getAdminDeadlines` is synchronous and does not access a database or network. The dedicated legacy parity suite is available with `npm run test:admin-parity` and requires reference database credentials.

ΝΕΑ ΤΑΚΤΙΚΗ ΜΟΝΟΜΕΛΟΥΣ (ν.5221/2025)
ΓΑΚ 206/2026 ΠΡΩΤΟΔΙΚΕΙΟ ΑΘΗΝΩΝ
https://legalverticalsaas-git-preview-aa7362-vagelis-koutkias-projects.vercel.app/civil-cases/e4490003-9bee-43f0-9e59-3df9416d775f
