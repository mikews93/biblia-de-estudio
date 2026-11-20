#!/usr/bin/env python3
"""Genera los carruseles de Zarza desde datos. Uso: python3 gen.py <carpeta_salida>"""
import sys, os, json

OUT = sys.argv[1]
HEAD = """<!doctype html><html lang="es"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..800;1,9..144,300..700&family=Inter:wght@400;500;600;700&family=Gentium+Book+Plus:ital,wght@0,400;0,700;1,400&family=Noto+Serif+Hebrew:wght@400;600&display=block" rel="stylesheet">
<link rel="stylesheet" href="base.css"><style>
.he{font-family:"Noto Serif Hebrew","Gentium Book Plus",serif;direction:rtl;unicode-bidi:isolate}
.word{background:rgba(232,145,63,.08);border:1px solid rgba(232,145,63,.35);border-radius:36px;padding:56px 56px 52px;margin-top:8px}
.word .w{font-family:"Gentium Book Plus",serif;font-size:132px;line-height:1.1;color:var(--amber2)}
.word .tr{font-size:34px;color:var(--soft);font-style:italic;margin:10px 0 34px}
.word .d{font-size:40px;line-height:1.45;color:var(--ink)}
.word .k{margin-top:30px;font-size:26px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:600}
.pair{background:var(--card);border:1px solid var(--line);border-radius:30px;padding:36px 40px;margin-bottom:28px}
.pair .r{font-size:24px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;margin-bottom:12px}
.pair .p .r{color:var(--muted)} .pair .c .r{color:var(--amber)}
.pair .v{font-family:Fraunces,serif;font-size:36px;line-height:1.38;font-variation-settings:"opsz" 36}
.pair .p .v{color:var(--muted)}
.pair .ar{display:flex;align-items:center;gap:16px;margin:20px 0;color:var(--amber);font-size:24px;font-weight:600;letter-spacing:.08em;text-transform:uppercase}
.pair .ar::before,.pair .ar::after{content:"";flex:1;height:1px;background:var(--line)}
.step{display:flex;gap:36px;align-items:flex-start}
.step .num{font-family:Fraunces,serif;font-size:220px;line-height:.8;color:var(--amber);opacity:.9;font-weight:400}
.step .tm{display:inline-block;margin-bottom:24px;padding:10px 22px;border-radius:999px;border:1px solid var(--line);font-size:26px;color:var(--muted)}
.tip{margin-top:56px;display:flex;gap:24px;align-items:flex-start;padding:34px 38px;border-radius:28px;background:rgba(232,145,63,.08);border:1px solid rgba(232,145,63,.3);font-size:34px;line-height:1.45}
.tip b{color:var(--amber);white-space:nowrap}
.list li{font-size:34px}
</style></head><body>"""

def top(i, n):
    return f'<div class="top"><div class="brand"><img src="llama.svg">Zarza</div><div class="n">{i} / {n}</div></div>'

def foot(l, r="→", go=True):
    return f'<div class="foot"><span>{l}</span><span class="go">{r}</span></div>'

def slide(s, i, n):
    t = s["t"]; f = s.get("foot", ""); last = i == n
    fr = "Enlace en la bio" if last else ("Desliza →" if i == 1 else "→")
    b = ""
    if t == "cover":
        ghost = f'<div class="ghost {s.get("gcls","")}">{s["ghost"]}</div>' if s.get("ghost") else ""
        b = f'{ghost}<div class="body"><div class="eyebrow">{s["eb"]}</div><h1>{s["h"]}</h1><p class="lead">{s["lead"]}</p></div>'
    elif t == "verse":
        th = f'<div class="thought">{s["th"]}</div>' if s.get("th") else ""
        b = f'<div class="body"><div class="eyebrow">{s["eb"]}</div><div class="verse">«{s["v"]}»</div><div class="ref">{s["ref"]} · Reina-Valera 1909</div>{th}</div>'
    elif t == "word":
        b = f'<div class="body"><div class="eyebrow">{s["eb"]}</div><div class="word"><div class="w {s.get("cls","")}">{s["w"]}</div><div class="tr">{s["tr"]}</div><div class="d">{s["d"]}</div><div class="k">{s["k"]}</div></div></div>'
    elif t == "big":
        th = f'<div class="thought" style="margin-top:72px">{s["th"]}</div>' if s.get("th") else ""
        b = f'<div class="body"><div class="eyebrow">{s["eb"]}</div><div class="big">{s["h"]}</div>{th}</div>'
    elif t == "refs":
        rc = "".join(f'<div class="rc"><div class="r">{r}</div><div class="v">«{v}»</div></div>' for r, v in s["refs"])
        b = f'<div class="body"><div class="eyebrow">{s["eb"]}</div><h2 style="margin-bottom:48px">{s["h"]}</h2><div class="refs">{rc}</div></div>'
    elif t == "pairs":
        ps = "".join(f'<div class="pair"><div class="p"><div class="r">{a}</div><div class="v">«{av}»</div></div><div class="ar">se cumplió</div><div class="c"><div class="r">{c}</div><div class="v">«{cv}»</div></div></div>' for a, av, c, cv in s["pairs"])
        th = f'<div class="thought" style="margin-top:44px">{s["th"]}</div>' if s.get("th") else ""
        b = f'<div class="body"><div class="eyebrow">{s["eb"]}</div>{ps}{th}</div>'
    elif t == "step":
        b = f'<div class="body"><div class="step"><div class="num">{s["num"]}</div><div><div class="tm">{s["tm"]}</div><h2>{s["h"]}</h2></div></div><p class="lead" style="margin-top:48px">{s["d"]}</p><div class="tip"><b>En Zarza</b><span>{s["tip"]}</span></div></div>'
    elif t == "cta":
        li = "".join(f'<li><i>{ic}</i>{tx}</li>' for ic, tx in s["items"])
        b = f'<div class="body"><img class="mark" src="llama.svg"><h2>{s["h"]}</h2><ul class="list">{li}</ul><div class="cta"><div class="pill">Gratis en Google Play</div><div class="url">zarzabiblia.com</div></div></div>'
        f = f or "Biblia de estudio · gratis"
    return f'<section class="s">{top(i, n)}{b}{foot(f, fr)}</section>'

CTA_ORIG = [("αβ", "Griego y hebreo palabra por palabra"), ("≡", "Concordancia: dónde más aparece"), ("↔", "Referencias cruzadas"), ("?", "Una IA que te guía a estudiar")]
CTA_CONEX = [("↔", "Referencias cruzadas en cada versículo"), ("⌒", "Todas las conexiones en arcos"), ("✓", "Promesa y cumplimiento"), ("—", "Línea de tiempo")]

C = {}
C["03-getsemani"] = dict(fecha="2026-12-01", slides=[
 dict(t="cover", eb="Curiosidades del original", h="Jesús oró en un lugar llamado <em>prensa de aceite.</em>", lead="Getsemaní no es solo un nombre bonito.", ghost="Γεθσημανῆ", foot="Mateo 26"),
 dict(t="verse", eb="El lugar", v="Entonces llegó Jesús con ellos á la aldea que se llama <mark>Gethsemaní</mark>, y dice á sus discípulos: Sentaos aquí, hasta que vaya allí y ore.", ref="Mateo 26:36", th="Era un huerto de olivos, al pie del monte de los Olivos.", foot="¿Qué quiere decir ese nombre?"),
 dict(t="word", eb="El nombre", w="Γεθσημανῆ", tr="Gethsēmanē", d="Viene del arameo <b>gat shemanim</b>: <em>«prensa de aceite»</em>. Allí se aplastaban las aceitunas hasta sacarles el aceite.", k="Nombre de lugar · arameo", foot="Y allí Jesús fue prensado"),
 dict(t="refs", eb="Lo que pasó en la prensa", h="Bajo el peso, <em>oró.</em>", refs=[("Mateo 26:39", "Padre mío, si es posible, pase de mí este vaso; empero no como yo quiero, sino como tú."), ("Lucas 22:44", "Y estando en agonía, oraba más intensamente: y fué su sudor como grandes gotas de sangre que caían hasta la tierra.")], foot="Reina-Valera 1909"),
 dict(t="big", eb="Para llevar a casa", h="De esa prensa no salió queja. <em>Salió obediencia.</em>", th="<b>Para pensar hoy:</b> ¿qué estás llevando a tu propio Getsemaní? Llévalo orando, como Él.", foot="Guárdalo para volver a leerlo"),
 dict(t="cta", h="Esto se descubre <em>tocando un nombre</em> en Zarza.", items=[("◉", "Fichas de personajes y lugares"), ("⌖", "Un mapa que sigue tu lectura"), ("αβ", "Griego y hebreo palabra por palabra"), ("♪", "Capítulos dramatizados y pódcast")]),
], texto="""Getsemaní quiere decir «prensa de aceite» (del arameo gat shemanim). 🫒

Allí se aplastaban las aceitunas hasta sacarles el aceite. Y allí, bajo el peso de la cruz que venía, Jesús oró: «no como yo quiero, sino como tú».

Lo descubres tocando el nombre en Zarza: fichas de lugares, mapa e interlineal. Gratis.
📲 Enlace en la bio · zarzabiblia.com

¿Qué estás llevando hoy a tu propio Getsemaní?

#Getsemaní #Biblia #EstudioBiblico #Jesús #Oración #Devocional #Zarza""")

C["04-isaias-53"] = dict(fecha="2026-12-04", slides=[
 dict(t="cover", eb="Promesa y cumplimiento", h="Isaías lo escribió <em>unos 700 años antes</em> de la cruz.", lead="5 detalles de Isaías 53 que se cumplieron en Jesús.", ghost="53", foot="Isaías 53"),
 dict(t="pairs", eb="1 y 2", pairs=[("Isaías 53:7", "no abrió su boca: como cordero fué llevado al matadero", "Mateo 27:14", "Y no le respondió ni una palabra"), ("Isaías 53:9", "mas con los ricos fué en su muerte", "Mateo 27:57", "vino un hombre rico de Arimatea, llamado José")], foot="José le dio su propio sepulcro"),
 dict(t="pairs", eb="3 y 4", pairs=[("Isaías 53:12", "y fué contado con los perversos", "Lucas 22:37", "es necesario que se cumpla todavía en mí aquello que está escrito"), ("Isaías 53:4", "Ciertamente llevó él nuestras enfermedades", "Mateo 8:17", "Para que se cumpliese lo que fué dicho por el profeta Isaías")], foot="Jesús mismo lo citó"),
 dict(t="pairs", eb="5", pairs=[("Isaías 53:5", "y por su llaga fuimos nosotros curados", "1 Pedro 2:24", "por la herida del cual habéis sido sanados")], th="Isaías lo escribió en pasado, como algo ya hecho. <b>Pedro lo aplica a quienes creen: «habéis sido sanados».</b>", foot="Pedro lo cita casi palabra por palabra"),
 dict(t="verse", eb="Alguien lo leía sin entender", v="Entonces Felipe, abriendo su boca, y comenzando desde esta escritura, <mark>le anunció el evangelio de Jesús</mark>.", ref="Hechos 8:35", th="El etíope iba leyendo Isaías 53 y no sabía de quién hablaba. <b>Felipe le mostró que hablaba de Jesús.</b>", foot="Hechos 8:26-39"),
 dict(t="big", eb="Para llevar a casa", h="La Biblia no son 66 libros sueltos. <em>Es una sola historia.</em>", th="<b>Para pensar hoy:</b> si Dios cumplió lo que prometió 700 años antes, ¿qué promesa suya puedes creerle hoy?", foot="Compártelo con quien lo necesite"),
 dict(t="cta", h="Zarza te muestra <em>la promesa y su cumplimiento</em> lado a lado.", items=CTA_CONEX),
], texto="""Isaías 53 se escribió unos 700 años antes de la cruz. ✝️

1. «No abrió su boca» → Mateo 27:14
2. «Con los ricos fué en su muerte» → Mateo 27:57
3. «Fué contado con los perversos» → Lucas 22:37
4. «Llevó él nuestras enfermedades» → Mateo 8:17
5. «Por su llaga fuimos nosotros curados» → 1 Pedro 2:24

En Zarza ves la promesa y su cumplimiento lado a lado, con todas las referencias cruzadas. Gratis.
📲 Enlace en la bio · zarzabiblia.com

#Isaías53 #Profecía #Biblia #EstudioBiblico #Jesús #Zarza""")

C["05-denario"] = dict(fecha="2026-12-08", slides=[
 dict(t="cover", eb="Contexto que cambia la lectura", h="¿Cuánto valía <em>un denario?</em>", lead="La parábola de los obreros se entiende mejor cuando sabes cuánto ganaban.", ghost="δηνάριον", foot="Mateo 20"),
 dict(t="verse", eb="El trato", v="Y habiéndose concertado con los obreros en <mark>un denario al día</mark>, los envió á su viña.", ref="Mateo 20:2", th="Un denario era la paga normal de <b>un día de trabajo</b> en el campo.", foot="¿Qué era un denario?"),
 dict(t="word", eb="La moneda", w="δηνάριον", tr="dēnarion", d="Moneda romana de plata. Era el jornal de un obrero: <em>lo que una familia necesitaba para vivir ese día.</em>", k="Sustantivo · moneda", foot="Y ahora, lo sorprendente"),
 dict(t="verse", eb="Los últimos", v="Y viniendo los que habían ido cerca de <mark>la hora undécima</mark>, recibieron cada uno un denario.", ref="Mateo 20:9", th="La hora undécima eran las 5 de la tarde. <b>Trabajaron solo una hora</b> y recibieron el pago de un día entero.", foot="¿Injusto?"),
 dict(t="big", eb="Para llevar a casa", h="No les pagó lo que merecían. <em>Les dio lo que necesitaban para vivir.</em>", th="«¿es malo tu ojo, porque yo soy bueno?» (Mateo 20:15). <b>Así es la gracia.</b>", foot="Guárdalo para volver a leerlo"),
 dict(t="cta", h="Monedas, medidas y costumbres <em>explicadas</em> mientras lees.", items=[("$", "Monedas y medidas explicadas"), ("◉", "Fichas de personajes y lugares"), ("✎", "Comentarios clásicos en cada versículo"), ("?", "Una IA que responde con el texto")]),
], texto="""¿Cuánto valía un denario? 🪙

Era la paga de un día de trabajo en el campo: lo que una familia necesitaba para vivir ese día. En la parábola de Mateo 20, los que llegaron a la hora undécima (las 5 de la tarde) trabajaron una hora… y recibieron el día completo.

No les dio lo que merecían. Les dio lo que necesitaban. Así es la gracia.

En Zarza ves monedas, medidas y costumbres explicadas mientras lees. Gratis.
📲 Enlace en la bio · zarzabiblia.com

#Parábolas #Mateo20 #Gracia #Biblia #EstudioBiblico #Zarza""")

C["06-diez-minutos"] = dict(fecha="2026-12-11", slides=[
 dict(t="cover", eb="Cómo estudiar", h="Estudia un capítulo <em>en 10 minutos.</em>", lead="Un método sencillo, paso a paso, con Juan 3 de ejemplo.", ghost="10′", foot="Guárdalo para usarlo"),
 dict(t="step", num="1", tm="2 minutos", h="<em>Lee</em> todo de una vez", d="Sin detenerte ni subrayar. Solo para saber de qué trata.", tip="Escúchalo dramatizado, con voces y música, mientras lo lees.", foot="Paso 1 de 5"),
 dict(t="step", num="2", tm="3 minutos", h="<em>Observa</em> lo que se repite", d="En Juan 3, el verbo «creer» aparece 8 veces. Ahí está el corazón del capítulo.", tip="Toca una palabra y ve el griego y en qué otros versículos aparece.", foot="Paso 2 de 5"),
 dict(t="step", num="3", tm="2 minutos", h="<em>Conecta</em> con otro pasaje", d="Juan 3:14 habla de la serpiente que Moisés levantó. Te lleva a Números 21.", tip="Cada versículo tiene sus referencias cruzadas a un toque.", foot="Paso 3 de 5"),
 dict(t="step", num="4", tm="2 minutos", h="<em>Pregunta</em> lo que no entiendes", d="¿Qué es nacer «del agua y del Espíritu»? Escríbelo y deja que el texto responda.", tip="La IA del estudio te responde con el texto y sus citas a la vista.", foot="Paso 4 de 5"),
 dict(t="step", num="5", tm="1 minuto", h="<em>Aplica</em> en una frase", d="¿Qué hago hoy con esto? Una sola frase basta.", tip="Guárdala en tus notas para volver a ella mañana.", foot="Paso 5 de 5"),
 dict(t="cta", h="Leer, observar, conectar, preguntar y aplicar, <em>en una sola app.</em>", items=[("♪", "Capítulos dramatizados"), ("αβ", "Griego y hebreo palabra por palabra"), ("↔", "Referencias cruzadas"), ("?", "Preguntas con IA y notas")]),
], texto="""Cómo estudiar un capítulo de la Biblia en 10 minutos 📖⏱️

1. Lee todo de una vez (2 min)
2. Observa lo que se repite (3 min): en Juan 3, «creer» aparece 8 veces
3. Conecta con otro pasaje (2 min): Juan 3:14 → Números 21
4. Pregunta lo que no entiendes (2 min)
5. Aplica en una frase (1 min)

En Zarza tienes todo en una sola pantalla: dramatizado, interlineal, referencias, IA y notas. Gratis.
📲 Enlace en la bio · zarzabiblia.com

Guárdalo y pruébalo esta semana con tu grupo. 🙌

#EstudioBiblico #ComoEstudiarLaBiblia #Biblia #Devocional #Zarza""")

C["07-ezer"] = dict(fecha="2026-12-15", slides=[
 dict(t="cover", eb="Curiosidades del hebreo", h="«Ayuda idónea» no quiere decir <em>ayudante de segunda.</em>", lead="La misma palabra hebrea se usa para Dios.", ghost="עֵזֶר", gcls="he", foot="Génesis 2:18"),
 dict(t="verse", eb="El texto", v="Y dijo Jehová Dios: No es bueno que el hombre esté solo; haréle <mark>ayuda idónea</mark> para él.", ref="Génesis 2:18", th="Muchos lo leen como «una asistente». <b>El hebreo dice algo mucho más fuerte.</b>", foot="Mira la palabra original"),
 dict(t="word", eb="La palabra", w="עֵזֶר", cls="he", tr="ʿēzer", d="<b>«Ayuda, socorro».</b> En el Antiguo Testamento, la mayoría de las veces es la ayuda <em>que viene de Dios.</em>", k="Sustantivo · hebreo", foot="¿Dónde más aparece?"),
 dict(t="refs", eb="La misma palabra, para Dios", h="Dios es nuestro <em>ʿēzer.</em>", refs=[("Salmo 121:2", "Mi socorro viene de Jehová, que hizo los cielos y la tierra."), ("Salmo 33:20", "Nuestra alma esperó á Jehová; nuestra ayuda y nuestro escudo es él.")], foot="Reina-Valera 1909"),
 dict(t="big", eb="Para llevar a casa", h="Ser ayuda no es ser menos. <em>Es parecerse a Dios.</em>", th="<b>Para pensar hoy:</b> ¿a quién puedes socorrer esta semana?", foot="Compártelo con tu pareja"),
 dict(t="cta", h="Esto se descubre <em>tocando una palabra</em> en Zarza.", items=CTA_ORIG),
], texto="""«Ayuda idónea» (Génesis 2:18) no quiere decir «ayudante de segunda». 💛

La palabra hebrea es עֵזֶר (ʿēzer): ayuda, socorro. Y la mayoría de las veces que aparece en el Antiguo Testamento se usa para Dios mismo: «Mi socorro viene de Jehová» (Salmo 121:2).

Ser ayuda no es ser menos. Es parecerse a Dios.

Lo descubres tocando la palabra en el interlineal hebreo de Zarza. Gratis.
📲 Enlace en la bio · zarzabiblia.com

#Génesis #Matrimonio #HebreoBiblico #Biblia #EstudioBiblico #Zarza""")

C["08-moriah"] = dict(fecha="2026-12-18", slides=[
 dict(t="cover", eb="Conexiones", h="«Dios se proveerá de cordero» <em>tuvo respuesta.</em>", lead="De Abraham en el monte Moriah a Juan en el Jordán.", foot="Génesis 22"),
 dict(t="verse", eb="La prueba", v="Toma ahora tu hijo, tu único, Isaac, <mark>á quien amas</mark>, y vete á tierra de Moriah", ref="Génesis 22:2", th="En hebreo, es <b>la primera vez</b> que la Biblia usa el verbo «amar». Y es el amor de un padre por su único hijo.", foot="Y en el camino, una pregunta"),
 dict(t="verse", eb="La respuesta de Abraham", v="Y respondió Abraham: <mark>Dios se proveerá de cordero</mark> para el holocausto, hijo mío. E iban juntos.", ref="Génesis 22:8", th="Isaac preguntó dónde estaba el cordero. <b>Abraham no lo veía, pero confió.</b>", foot="Siglos después…"),
 dict(t="refs", eb="La historia continúa", h="El mismo monte, <em>el Cordero prometido.</em>", refs=[("2 Crónicas 3:1", "Y comenzó Salomón á edificar la casa en Jerusalem, en el monte Moria"), ("Juan 1:29", "He aquí el Cordero de Dios, que quita el pecado del mundo.")], foot="Reina-Valera 1909"),
 dict(t="big", eb="Para llevar a casa", h="Lo que Dios le evitó a Abraham, <em>lo hizo Él mismo con su Hijo.</em>", th="<b>Para pensar hoy:</b> ¿en qué necesitas confiar, como Abraham, en que Dios proveerá?", foot="Guárdalo para volver a leerlo"),
 dict(t="cta", h="Zarza te muestra <em>cómo se conecta</em> toda la Biblia.", items=CTA_CONEX),
], texto="""«Dios se proveerá de cordero» (Génesis 22:8) 🐑

Abraham subió al monte Moriah con Isaac, su único hijo, a quien amaba. En hebreo es la primera vez que la Biblia usa el verbo «amar».

Siglos después, en ese mismo monte se construyó el templo (2 Crónicas 3:1). Y Juan el Bautista señaló a Jesús: «He aquí el Cordero de Dios» (Juan 1:29).

En Zarza ves estas conexiones con las referencias cruzadas de cada versículo. Gratis.
📲 Enlace en la bio · zarzabiblia.com

#Abraham #CorderoDeDios #Biblia #EstudioBiblico #Navidad #Zarza""")

C["09-emanuel"] = dict(fecha="2026-12-22", slides=[
 dict(t="cover", eb="Navidad en hebreo", h="El nombre de la Navidad <em>es una frase completa.</em>", lead="Emanuel.", ghost="עִמָּנוּ אֵל", gcls="he", foot="Isaías 7:14 · Mateo 1:23"),
 dict(t="verse", eb="La promesa", v="He aquí que la virgen concebirá, y parirá hijo, y llamará su nombre <mark>Emmanuel</mark>.", ref="Isaías 7:14", th="Isaías lo anunció <b>unos 700 años antes</b> del pesebre.", foot="¿Qué quiere decir?"),
 dict(t="word", eb="El nombre", w="עִמָּנוּ אֵל", cls="he", tr="ʿImmānû ʾēl", d="<b>ʿimmānû</b> = con nosotros · <b>ʾēl</b> = Dios.<br><em>«Con nosotros, Dios».</em>", k="Nombre propio · hebreo", foot="Mateo lo traduce"),
 dict(t="verse", eb="El cumplimiento", v="y llamarás su nombre Emmanuel, que declarado, es: <mark>Con nosotros Dios</mark>.", ref="Mateo 1:23", th="Mateo mismo lo explica para sus lectores. <b>Jesús es Dios con nosotros.</b>", foot="Y Juan lo dice así…"),
 dict(t="big", eb="Para llevar a casa", h="Navidad no es que Dios se acordó de nosotros. <em>Es que vino a estar con nosotros.</em>", th="«Y aquel Verbo fué hecho carne, y habitó entre nosotros» (Juan 1:14). <b>¿Con quién puedes estar tú esta Navidad?</b>", foot="Compártelo esta Navidad"),
 dict(t="cta", h="Lee la Navidad <em>en el idioma en que se escribió.</em>", items=CTA_ORIG),
], texto="""El nombre de la Navidad es una frase completa: Emanuel. ✨

En hebreo, עִמָּנוּ אֵל (ʿImmānû ʾēl): «con nosotros, Dios». Isaías lo anunció unos 700 años antes (Isaías 7:14) y Mateo lo explica: «Con nosotros Dios» (Mateo 1:23).

Navidad no es que Dios se acordó de nosotros. Es que vino a estar con nosotros.

Lee la Navidad en el idioma en que se escribió, con el interlineal de Zarza. Gratis.
📲 Enlace en la bio · zarzabiblia.com

#Navidad #Emanuel #Biblia #HebreoBiblico #EstudioBiblico #Zarza""")

C["10-juan-1-5"] = dict(fecha="2026-12-29", slides=[
 dict(t="cover", eb="Por qué difieren las versiones", h="¿Las tinieblas no <em>comprendieron</em> la luz, o no la <em>vencieron?</em>", lead="Juan 1:5 se traduce de dos maneras. Y las dos tienen razón.", ghost="κατέλαβεν", foot="Juan 1:5"),
 dict(t="verse", eb="La Reina-Valera dice", v="Y la luz en las tinieblas resplandece; mas las tinieblas <mark>no la comprendieron</mark>.", ref="Juan 1:5", th="Otras traducciones dicen: «las tinieblas <b>no la vencieron</b>». ¿Cuál es la correcta?", foot="Mira el griego"),
 dict(t="word", eb="La palabra", w="κατέλαβεν", tr="katelaben", d="De <b>katalambanō</b>: «agarrar, apoderarse de». Se puede agarrar con la mente <em>(comprender)</em> o con la mano <em>(atrapar, vencer)</em>.", k="Verbo · griego", foot="Las dos ideas están ahí"),
 dict(t="big", eb="Para llevar a casa", h="Las tinieblas no entendieron la luz <em>y tampoco pudieron apagarla.</em>", th="<b>Para empezar el año:</b> ¿qué oscuridad en tu vida necesita saber que no puede vencer la luz?", foot="Comparar versiones no es dudar: es ver más"),
 dict(t="cta", h="Compara versiones y mira <em>por qué difieren.</em>", items=[("⇄", "Comparar versiones lado a lado"), ("αβ", "«Por qué difieren», con la palabra original"), ("≡", "Concordancia del griego y el hebreo"), ("?", "Una IA que te guía a estudiar")]),
], texto="""¿Las tinieblas no «comprendieron» la luz, o no la «vencieron»? 🕯️

Juan 1:5 usa κατέλαβεν (katelaben), de un verbo que significa «agarrar, apoderarse de». Se puede agarrar con la mente (comprender) o con la mano (vencer). Por eso las versiones difieren, y las dos ideas están en el texto.

Las tinieblas no entendieron la luz y tampoco pudieron apagarla.

En Zarza comparas versiones lado a lado y ves por qué difieren, con la palabra original. Gratis.
📲 Enlace en la bio · zarzabiblia.com

#Juan1 #GriegoBiblico #Biblia #EstudioBiblico #AñoNuevo #Zarza""")

for name, c in C.items():
    n = len(c["slides"])
    html = HEAD + "".join(slide(s, i + 1, n) for i, s in enumerate(c["slides"])) + "</body></html>"
    open(os.path.join(OUT, name + ".html"), "w").write(html)
    os.makedirs(os.path.join(OUT, name), exist_ok=True)
    open(os.path.join(OUT, name, "texto.txt"), "w").write(c["texto"].strip() + "\n")
json.dump({k: v["fecha"] for k, v in C.items()}, open(os.path.join(OUT, "fechas.json"), "w"), indent=1)
print("ok", len(C))
