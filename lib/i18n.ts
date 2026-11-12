// Language support for the Chamber (education + voice) and the CareRelay Watch.
// English text is the backend's approved wording (CareRelay-B/backend/data/retina.json and
// docs/VOICE_SCRIPTS.json). French, Hindi and Tamil are draft translations made for this demo:
// they have NOT been validated by a qualified medical translator. The UI says so whenever a
// non-English language is selected.

export type Lang = "en" | "fr" | "hi" | "ta";

export const LANGS: { code: Lang; label: string; short: string; speech: string }[] = [
  { code: "en", label: "English", short: "EN", speech: "en-CA" },
  { code: "fr", label: "Français", short: "FR", speech: "fr-CA" },
  { code: "hi", label: "हिन्दी", short: "HI", speech: "hi-IN" },
  { code: "ta", label: "தமிழ்", short: "TA", speech: "ta-IN" },
];

type T = Record<Exclude<Lang, "en">, string>;

/** Keyed by the exact English source sentence so backend wording stays the source of truth. */
const CONTENT: Record<string, T> = {
  "At the back of the eye, the retina turns incoming light into signals used for vision.": {
    fr: "À l'arrière de l'œil, la rétine transforme la lumière en signaux utilisés pour la vision.",
    hi: "आँख के पीछे, रेटिना आने वाली रोशनी को देखने के लिए इस्तेमाल होने वाले संकेतों में बदलती है।",
    ta: "கண்ணின் பின்பகுதியில், விழித்திரை உள்வரும் ஒளியைப் பார்வைக்குப் பயன்படும் சமிக்ஞைகளாக மாற்றுகிறது.",
  },
  "The macula is the retinal area used for sharp central vision.": {
    fr: "La macula est la zone de la rétine qui sert à la vision centrale nette.",
    hi: "मैक्युला रेटिना का वह हिस्सा है जो साफ़ केंद्रीय दृष्टि के लिए इस्तेमाल होता है।",
    ta: "மாக்குலா என்பது கூர்மையான மையப் பார்வைக்குப் பயன்படும் விழித்திரைப் பகுதி.",
  },
  "Diabetes can damage the small retinal vessels, affecting blood flow and allowing fluid or blood to escape.": {
    fr: "Le diabète peut abîmer les petits vaisseaux de la rétine, ce qui modifie la circulation et laisse s'échapper du liquide ou du sang.",
    hi: "मधुमेह रेटिना की छोटी रक्त वाहिकाओं को नुकसान पहुँचा सकता है, जिससे रक्त प्रवाह प्रभावित होता है और तरल या रक्त बाहर निकल सकता है।",
    ta: "நீரிழிவு விழித்திரையின் சிறிய இரத்த நாளங்களைச் சேதப்படுத்தலாம்; இதனால் இரத்த ஓட்டம் பாதிக்கப்பட்டு திரவம் அல்லது இரத்தம் கசியலாம்.",
  },
  "Signals from the retina travel along the optic nerve to the brain.": {
    fr: "Les signaux de la rétine voyagent jusqu'au cerveau par le nerf optique.",
    hi: "रेटिना से संकेत ऑप्टिक नर्व के रास्ते मस्तिष्क तक जाते हैं।",
    ta: "விழித்திரையிலிருந்து வரும் சமிக்ஞைகள் பார்வை நரம்பு வழியாக மூளைக்குச் செல்கின்றன.",
  },
  "The clear front surface bends incoming light to help focus it.": {
    fr: "La surface avant transparente dévie la lumière pour aider à la mise au point.",
    hi: "आँख की साफ़ सामने की सतह आने वाली रोशनी को मोड़कर उसे केंद्रित करने में मदद करती है।",
    ta: "முன்புறத் தெளிவான மேற்பரப்பு உள்வரும் ஒளியை வளைத்து குவிக்க உதவுகிறது.",
  },
  "Inside the eye, the lens helps focus light onto the retina.": {
    fr: "À l'intérieur de l'œil, le cristallin aide à focaliser la lumière sur la rétine.",
    hi: "आँख के अंदर, लेंस रोशनी को रेटिना पर केंद्रित करने में मदद करता है।",
    ta: "கண்ணின் உள்ளே, லென்ஸ் ஒளியை விழித்திரையில் குவிக்க உதவுகிறது.",
  },
  "Diabetes-related retinal changes can begin without noticeable symptoms. A dilated eye examination lets an eye professional check the retina. A record reminder is a reason to clarify documented follow-up, not evidence that someone has retinal disease.": {
    fr: "Les changements de la rétine liés au diabète peuvent commencer sans symptômes visibles. Un examen avec dilatation permet à un professionnel des yeux de vérifier la rétine. Un rappel dans le dossier est une raison de clarifier le suivi prévu, pas une preuve de maladie de la rétine.",
    hi: "मधुमेह से जुड़े रेटिना के बदलाव बिना किसी लक्षण के शुरू हो सकते हैं। पुतली फैलाकर की गई आँखों की जाँच से नेत्र विशेषज्ञ रेटिना देख पाते हैं। रिकॉर्ड में याद दिलाना, दर्ज फ़ॉलो-अप को स्पष्ट करने का कारण है, यह किसी बीमारी का सबूत नहीं है।",
    ta: "நீரிழிவு தொடர்பான விழித்திரை மாற்றங்கள் அறிகுறிகள் இல்லாமலே தொடங்கலாம். கண்மணியை விரித்துச் செய்யும் பரிசோதனையில் கண் நிபுணர் விழித்திரையைச் சரிபார்க்க முடியும். பதிவில் உள்ள நினைவூட்டல், பதிவான பின்தொடர்வைத் தெளிவுபடுத்துவதற்கான காரணம் மட்டுமே; நோய் உள்ளது என்பதற்கான சான்று அல்ல.",
  },
  "In early diabetic retinopathy, small vessel walls may weaken and bulge. People may not notice symptoms.": {
    fr: "Au début de la rétinopathie diabétique, la paroi des petits vaisseaux peut s'affaiblir et se bomber. Les personnes peuvent ne rien remarquer.",
    hi: "डायबिटिक रेटिनोपैथी की शुरुआत में, छोटी वाहिकाओं की दीवारें कमज़ोर होकर उभर सकती हैं। लोगों को कोई लक्षण महसूस नहीं हो सकता।",
    ta: "நீரிழிவு விழித்திரை நோயின் தொடக்கத்தில், சிறிய நாளச் சுவர்கள் பலவீனமடைந்து புடைக்கலாம். மக்கள் அறிகுறிகளைக் கவனிக்காமல் இருக்கலாம்.",
  },
  "Fluid leaking from damaged vessels can cause swelling in the macula and affect central vision. This example is not a separate formal disease stage.": {
    fr: "Du liquide qui fuit de vaisseaux abîmés peut faire gonfler la macula et toucher la vision centrale. Cet exemple n'est pas un stade officiel distinct.",
    hi: "क्षतिग्रस्त वाहिकाओं से रिसने वाला तरल मैक्युला में सूजन पैदा कर सकता है और केंद्रीय दृष्टि पर असर डाल सकता है। यह उदाहरण बीमारी का कोई अलग औपचारिक चरण नहीं है।",
    ta: "சேதமடைந்த நாளங்களிலிருந்து கசியும் திரவம் மாக்குலாவில் வீக்கத்தை ஏற்படுத்தி மையப் பார்வையைப் பாதிக்கலாம். இந்த எடுத்துக்காட்டு தனியான முறையான நோய் நிலை அல்ல.",
  },
  "Advanced proliferative disease can involve fragile new vessels that bleed. This is a general example, not a forecast for any patient.": {
    fr: "Une maladie proliférante avancée peut comporter de nouveaux vaisseaux fragiles qui saignent. C'est un exemple général, pas une prévision pour un patient.",
    hi: "उन्नत प्रोलिफ़ेरेटिव बीमारी में नई नाज़ुक वाहिकाएँ बन सकती हैं जिनसे खून बह सकता है। यह एक सामान्य उदाहरण है, किसी मरीज़ के लिए भविष्यवाणी नहीं।",
    ta: "மேம்பட்ட பெருகும் நோயில் இரத்தம் கசியக்கூடிய மெல்லிய புதிய நாளங்கள் இருக்கலாம். இது பொதுவான எடுத்துக்காட்டு; எந்த நோயாளிக்கும் கணிப்பு அல்ல.",
  },
  "This reference view introduces retinal anatomy and visual signalling. It does not establish that a particular person's eyes are healthy.": {
    fr: "Cette vue de référence présente l'anatomie de la rétine et la transmission visuelle. Elle n'établit pas que les yeux d'une personne sont en bonne santé.",
    hi: "यह संदर्भ दृश्य रेटिना की बनावट और देखने के संकेतों का परिचय देता है। इससे यह तय नहीं होता कि किसी व्यक्ति की आँखें स्वस्थ हैं।",
    ta: "இந்தக் குறிப்புக் காட்சி விழித்திரை அமைப்பையும் பார்வைச் சமிக்ஞையையும் அறிமுகப்படுத்துகிறது. ஒருவரின் கண்கள் ஆரோக்கியமானவை என்பதை இது நிறுவவில்லை.",
  },
  "General educational visualization. This model does not represent the patient's actual eye. Only an appropriate healthcare professional can determine whether these changes are present.": {
    fr: "Visualisation éducative générale. Ce modèle ne représente pas l'œil réel de la patiente. Seul un professionnel de la santé qualifié peut déterminer si ces changements sont présents.",
    hi: "सामान्य शैक्षिक चित्रण। यह मॉडल मरीज़ की असली आँख नहीं दिखाता। केवल उपयुक्त स्वास्थ्य पेशेवर ही तय कर सकते हैं कि ये बदलाव मौजूद हैं या नहीं।",
    ta: "பொதுவான கல்விக் காட்சி. இந்த மாதிரி நோயாளியின் உண்மையான கண்ணைக் குறிக்கவில்லை. இந்த மாற்றங்கள் உள்ளனவா என்பதைத் தகுந்த சுகாதார நிபுணர் மட்டுமே தீர்மானிக்க முடியும்.",
  },
  "These four teaching views are simplified examples, not a clinical staging system, a prediction, or an inevitable sequence. Never assign a view to a patient from a follow-up signal.": {
    fr: "Ces quatre vues sont des exemples simplifiés, pas un système de stades cliniques, une prévision ou une suite inévitable. N'attribuez jamais une vue à une patiente à partir d'un signal de suivi.",
    hi: "ये चार शिक्षण दृश्य सरल उदाहरण हैं, न कि क्लिनिकल चरण प्रणाली, भविष्यवाणी या तय क्रम। किसी फ़ॉलो-अप संकेत के आधार पर किसी मरीज़ को कोई दृश्य न दें।",
    ta: "இந்த நான்கு கற்பித்தல் காட்சிகள் எளிமைப்படுத்தப்பட்ட எடுத்துக்காட்டுகள்; மருத்துவ நிலை முறையோ, கணிப்போ, தவிர்க்க முடியாத வரிசையோ அல்ல. பின்தொடர்வுச் சமிக்ஞையை வைத்து எந்த நோயாளிக்கும் ஒரு காட்சியை ஒதுக்க வேண்டாம்.",
  },
  "Review the original follow-up recommendation with your care team and clarify whether completion documentation exists. The Action Center can prepare a local calendar reminder after explicit approval. This prototype does not book appointments or send messages.": {
    fr: "Revoyez la recommandation de suivi d'origine avec votre équipe de soins et vérifiez s'il existe une preuve qu'il a été fait. Le centre d'action peut préparer un rappel de calendrier local après votre accord explicite. Ce prototype ne prend pas de rendez-vous et n'envoie pas de messages.",
    hi: "अपनी देखभाल टीम के साथ मूल फ़ॉलो-अप सलाह की समीक्षा करें और पूछें कि क्या इसके पूरा होने का कोई दस्तावेज़ है। आपकी स्पष्ट मंज़ूरी के बाद एक्शन सेंटर एक स्थानीय कैलेंडर रिमाइंडर बना सकता है। यह प्रोटोटाइप अपॉइंटमेंट बुक नहीं करता और संदेश नहीं भेजता।",
    ta: "அசல் பின்தொடர்வுப் பரிந்துரையை உங்கள் பராமரிப்புக் குழுவுடன் மீண்டும் பாருங்கள்; அது முடிந்ததற்கான ஆவணம் உள்ளதா என்று தெளிவுபடுத்துங்கள். உங்கள் வெளிப்படையான ஒப்புதலுக்குப் பிறகு செயல் மையம் ஒரு உள்ளூர் நாள்காட்டி நினைவூட்டலைத் தயாரிக்கலாம். இந்த முன்மாதிரி சந்திப்புகளை முன்பதிவு செய்யாது, செய்திகளை அனுப்பாது.",
  },
  "I cannot diagnose an eye condition, assign a disease stage, predict your vision, or recommend personal treatment. An eye-care professional must assess your eyes. I can explain the approved general topics or show the supplied record evidence.": {
    fr: "Je ne peux pas diagnostiquer une maladie des yeux, attribuer un stade, prédire votre vision ou recommander un traitement personnel. Un professionnel des soins des yeux doit examiner vos yeux. Je peux expliquer les sujets généraux approuvés ou montrer les preuves des dossiers fournis.",
    hi: "मैं आँख की किसी बीमारी का निदान नहीं कर सकता, बीमारी का चरण नहीं बता सकता, आपकी दृष्टि की भविष्यवाणी नहीं कर सकता या निजी इलाज की सलाह नहीं दे सकता। आपकी आँखों की जाँच नेत्र विशेषज्ञ को करनी होगी। मैं स्वीकृत सामान्य विषय समझा सकता हूँ या दिए गए रिकॉर्ड के सबूत दिखा सकता हूँ।",
    ta: "என்னால் கண் நோயைக் கண்டறியவோ, நோய் நிலையை ஒதுக்கவோ, உங்கள் பார்வையைக் கணிக்கவோ, தனிப்பட்ட சிகிச்சையைப் பரிந்துரைக்கவோ முடியாது. உங்கள் கண்களைக் கண் பராமரிப்பு நிபுணர் மதிப்பிட வேண்டும். அங்கீகரிக்கப்பட்ட பொதுத் தலைப்புகளை விளக்கவோ, வழங்கப்பட்ட பதிவுச் சான்றுகளைக் காட்டவோ என்னால் முடியும்.",
  },
};

/** Translate a backend English sentence; falls back to English if no draft translation exists. */
export function tr(text: string, lang: Lang): string {
  if (lang === "en") return text;
  return CONTENT[text]?.[lang] ?? text;
}

type UiKey =
  | "retina" | "macula" | "blood_vessels" | "optic_nerve" | "cornea" | "lens"
  | "normal" | "early" | "progressing" | "advanced"
  | "q_retina" | "q_follow_up" | "q_progression" | "q_next_steps"
  | "heart_rate" | "blood_pressure" | "steps" | "sleep" | "glucose" | "sharing"
  | "share_with_team" | "simulated_live" | "info_incomplete" | "no_bp_14" | "your_goal"
  | "last_night" | "reminder" | "did_you_complete" | "yes" | "not_yet" | "on" | "off"
  | "listen" | "stop" | "translation_note";

const UI: Record<UiKey, Record<Lang, string>> = {
  retina: { en: "Retina", fr: "Rétine", hi: "रेटिना", ta: "விழித்திரை" },
  macula: { en: "Macula", fr: "Macula", hi: "मैक्युला", ta: "மாக்குலா" },
  blood_vessels: { en: "Retinal blood vessels", fr: "Vaisseaux de la rétine", hi: "रेटिना की रक्त वाहिकाएँ", ta: "விழித்திரை இரத்த நாளங்கள்" },
  optic_nerve: { en: "Optic nerve", fr: "Nerf optique", hi: "ऑप्टिक नर्व", ta: "பார்வை நரம்பு" },
  cornea: { en: "Cornea", fr: "Cornée", hi: "कॉर्निया", ta: "கருவிழிப்படலம்" },
  lens: { en: "Lens", fr: "Cristallin", hi: "लेंस", ta: "லென்ஸ்" },
  normal: { en: "Normal", fr: "Normal", hi: "सामान्य", ta: "இயல்பு" },
  early: { en: "General early changes", fr: "Changements précoces (général)", hi: "सामान्य शुरुआती बदलाव", ta: "பொதுவான ஆரம்ப மாற்றங்கள்" },
  progressing: { en: "General progressing changes", fr: "Changements évolutifs (général)", hi: "सामान्य बढ़ते बदलाव", ta: "பொதுவான முன்னேறும் மாற்றங்கள்" },
  advanced: { en: "General advanced changes", fr: "Changements avancés (général)", hi: "सामान्य उन्नत बदलाव", ta: "பொதுவான மேம்பட்ட மாற்றங்கள்" },
  q_retina: { en: "What is the retina?", fr: "Qu'est-ce que la rétine ?", hi: "रेटिना क्या है?", ta: "விழித்திரை என்றால் என்ன?" },
  q_follow_up: { en: "Why does this follow-up matter?", fr: "Pourquoi ce suivi est-il important ?", hi: "यह फ़ॉलो-अप क्यों ज़रूरी है?", ta: "இந்தப் பின்தொடர்வு ஏன் முக்கியம்?" },
  q_progression: { en: "What can happen in general?", fr: "Que peut-il se passer en général ?", hi: "आम तौर पर क्या हो सकता है?", ta: "பொதுவாக என்ன நடக்கலாம்?" },
  q_next_steps: { en: "What can I do next?", fr: "Que puis-je faire ensuite ?", hi: "मैं आगे क्या कर सकती हूँ?", ta: "அடுத்து நான் என்ன செய்யலாம்?" },
  heart_rate: { en: "Heart rate", fr: "Fréquence cardiaque", hi: "हृदय गति", ta: "இதயத் துடிப்பு" },
  blood_pressure: { en: "Blood pressure", fr: "Tension artérielle", hi: "रक्तचाप", ta: "இரத்த அழுத்தம்" },
  steps: { en: "Steps", fr: "Pas", hi: "कदम", ta: "அடிகள்" },
  sleep: { en: "Sleep", fr: "Sommeil", hi: "नींद", ta: "தூக்கம்" },
  glucose: { en: "Glucose", fr: "Glycémie", hi: "ग्लूकोज़", ta: "குளுக்கோஸ்" },
  sharing: { en: "Sharing", fr: "Partage", hi: "साझा करना", ta: "பகிர்வு" },
  share_with_team: { en: "Share with care team", fr: "Partager avec l'équipe", hi: "देखभाल टीम से साझा करें", ta: "குழுவுடன் பகிர்" },
  simulated_live: { en: "Simulated live data", fr: "Données simulées", hi: "नकली लाइव डेटा", ta: "உருவகப்படுத்திய தரவு" },
  info_incomplete: { en: "Information incomplete", fr: "Information incomplète", hi: "जानकारी अधूरी", ta: "தகவல் முழுமையில்லை" },
  no_bp_14: { en: "No new reading in 14 days", fr: "Aucune mesure depuis 14 jours", hi: "14 दिनों से कोई नई रीडिंग नहीं", ta: "14 நாட்களாகப் புதிய அளவீடு இல்லை" },
  your_goal: { en: "Your goal", fr: "Votre objectif", hi: "आपका लक्ष्य", ta: "உங்கள் இலக்கு" },
  last_night: { en: "Last night", fr: "La nuit dernière", hi: "पिछली रात", ta: "நேற்றிரவு" },
  reminder: { en: "Reminder: arrange your retinal exam", fr: "Rappel : organisez votre examen de la rétine", hi: "रिमाइंडर: अपनी रेटिना जाँच तय करें", ta: "நினைவூட்டல்: விழித்திரைப் பரிசோதனையை ஏற்பாடு செய்யுங்கள்" },
  did_you_complete: { en: "Did you complete the retinal exam?", fr: "Avez-vous fait l'examen de la rétine ?", hi: "क्या आपने रेटिना की जाँच करवा ली?", ta: "விழித்திரைப் பரிசோதனையை முடித்தீர்களா?" },
  yes: { en: "Yes", fr: "Oui", hi: "हाँ", ta: "ஆம்" },
  not_yet: { en: "Not yet", fr: "Pas encore", hi: "अभी नहीं", ta: "இன்னும் இல்லை" },
  on: { en: "On", fr: "Oui", hi: "चालू", ta: "இயக்கு" },
  off: { en: "Off", fr: "Non", hi: "बंद", ta: "அணை" },
  listen: { en: "Listen", fr: "Écouter", hi: "सुनें", ta: "கேள்" },
  stop: { en: "Stop", fr: "Arrêter", hi: "रोकें", ta: "நிறுத்து" },
  translation_note: {
    en: "",
    fr: "Traduction de démonstration : le texte médical doit être validé par un traducteur qualifié.",
    hi: "डेमो अनुवाद: चिकित्सा पाठ की पुष्टि योग्य अनुवादक से होनी चाहिए।",
    ta: "செயல்விளக்க மொழிபெயர்ப்பு: மருத்துவ உரையைத் தகுதியான மொழிபெயர்ப்பாளர் சரிபார்க்க வேண்டும்.",
  },
};

export function ui(key: UiKey, lang: Lang): string {
  return UI[key][lang] || UI[key].en;
}
