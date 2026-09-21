# prothesmies

Deterministic Greek civil and administrative legal deadline calculators.

```ts
import {
  getAdminDeadlines,
} from 'prothesmies';

const result = getAdminDeadlines({
  court: 'dprotodikeioath',
  katigoria: 'Αγωγή',
  dikasimos: '2026-11-20',
  syntmisi: false,
});

if (result.status === 'success') {
  console.log(result.deadlines);
}
```

`getAdminDeadlines` is synchronous and does not access a database or network.

ΝΕΑ ΤΑΚΤΙΚΗ ΜΟΝΟΜΕΛΟΥΣ (ν.5221/2025)
ΓΑΚ 206/2026 ΠΡΩΤΟΔΙΚΕΙΟ ΑΘΗΝΩΝ
https://legalverticalsaas-git-preview-aa7362-vagelis-koutkias-projects.vercel.app/civil-cases/e4490003-9bee-43f0-9e59-3df9416d775f
