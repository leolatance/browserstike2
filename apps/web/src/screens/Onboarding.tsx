import { useMemo, useState } from 'react';
import { Rng } from '@idle-strike/engine';
import { hashSeed } from '../minigames/duelTarget';
import { createBox, openBox, rollInitialBox, type Reveal } from '../store/cards';
import { BoxOpen } from '../ui/BoxOpen';
import { useNavigate } from 'react-router-dom';
import { attrCap } from '../progression/xp';
import { CHARACTER, COUNTRIES, createCharacter, initialAttrs, validNick } from '../store/character';
import { resizeToJpeg } from '../ui/photo';
import { AttrBars } from '../ui/AttrBars';
import { Avatar } from '../ui/Avatar';
import ui from '../ui/ui.module.css';
import styles from './Onboarding.module.css';

export function Onboarding() {
  const nav = useNavigate();
  const [nick, setNick] = useState('');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [country, setCountry] = useState('BR');
  const [busy, setBusy] = useState(false);
  const [reveals, setReveals] = useState<Reveal[] | null>(null);
  const attrs = useMemo(() => initialAttrs(nick || 'novato'), [nick]);
  const ok = validNick(nick);

  const onFile = async (file?: File) => {
    if (!file) return;
    try {
      setPhoto(await resizeToJpeg(file));
    } catch {
      setPhoto(null);
    }
  };

  const create = async () => {
    if (!ok || busy) return;
    setBusy(true);
    await createCharacter(nick, country, photo ?? undefined);
    // GDD 6.4: initial box, rolled from the nick so it is reproducible.
    const boxId = await createBox('initial', rollInitialBox(new Rng(hashSeed(`box:${nick.trim().toLowerCase()}`))));
    setReveals(await openBox(boxId));
  };

  if (reveals) {
    return (
      <div className={ui.page}>
        <h1 className={ui.h1}>Box inicial</h1>
        <BoxOpen reveals={reveals} title="Box inicial" onDone={() => nav('/build', { replace: true })} />
      </div>
    );
  }

  return (
    <div className={ui.page}>

      <section className={ui.card}>
        <label className={ui.h2} htmlFor="nick">
          Nick
        </label>
        <input
          id="nick"
          className={ui.input}
          value={nick}
          maxLength={CHARACTER.NICK_MAX}
          placeholder="3 a 16 caracteres"
          autoComplete="off"
          onChange={(e) => setNick(e.target.value)}
        />
      </section>

      <section className={ui.card}>
        <span className={ui.h2}>Foto (opcional)</span>
        <div className={ui.row}>
          <Avatar photo={photo} nick={nick || '?'} size={56} />
          <label className={styles.file}>
            {photo ? 'trocar foto' : 'escolher foto'}
            <input type="file" accept="image/*" onChange={(e) => void onFile(e.target.files?.[0])} />
          </label>
          {photo && <button onClick={() => setPhoto(null)}>remover</button>}
        </div>
        <span className={ui.muted}>Sem foto, as iniciais do nick sobre uma cor fixa.</span>
      </section>

      <section className={ui.card}>
        <span className={ui.h2}>País</span>
        <div className={styles.countries}>
          {COUNTRIES.map((c) => (
            <button key={c.code} aria-pressed={country === c.code} onClick={() => setCountry(c.code)}>
              {c.flag} {c.name}
            </button>
          ))}
        </div>
      </section>

      <section className={ui.card}>
        <span className={ui.h2}>Atributos iniciais · cap {attrCap(0).toFixed(0)}</span>
        <AttrBars attrs={attrs} cap={attrCap(0)} />
      </section>

      <button className={`primary ${ui.big}`} disabled={!ok || busy} onClick={create}>
        Criar boneco
      </button>
    </div>
  );
}
