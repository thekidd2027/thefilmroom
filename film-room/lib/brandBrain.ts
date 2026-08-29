export type ScoringWeights = { popularity:number; currentRelevance:number; wowFactor:number; storyValue:number; brandFit:number; verticalViability:number };
export type SeasonalWeight = { sport:string; months:number[]; baseWeight:number };
export type MediaSourcingRule = { allowedSourceTypes:string[]; cautionSourceTypes:string[]; bannedSourceTypes:string[]; rationale:string };
export type MusicPolicy = { soundPalette:string[]; usageRule:string; rationale:string };
export type PenaltyRule = { key:string; description:string; penalty:number };
export type BrandVoice = { principles:string[]; bannedPhrases:string[]; captionStyle:string; coverStyle:string };
export type EditorialRules = { coreSports:string[]; currentVsFlashback:string; generalHypeFanRule:string; rivalryException:string; replacementRule:string; sourceRule:string; cameraAngleRule:string; reelLengthRule:string; templates:{name:string;job:string}[] };
export type BrandBrain = { scoringWeights:ScoringWeights; seasonalCalendar:SeasonalWeight[]; mediaSourcing:MediaSourcingRule; musicPolicy:MusicPolicy; penalties:PenaltyRule[]; voice:BrandVoice; editorialRules:EditorialRules; slateSize:number };

export const DEFAULT_BRAND_BRAIN: BrandBrain = {
 slateSize:5,
 scoringWeights:{popularity:.30,currentRelevance:.20,wowFactor:.25,storyValue:.05,brandFit:.15,verticalViability:.05},
 seasonalCalendar:[{sport:"football",months:[8,9,10,11,12,1],baseWeight:1.6},{sport:"basketball",months:[11,12,1,2,3,4],baseWeight:1.25}],
 mediaSourcing:{allowedSourceTypes:["licensed footage","original footage","permissioned creator/fan footage","platform reuse explicitly allowed by rightsholder"],cautionSourceTypes:["broadcast footage","official public highlights without explicit repost license","third-party compilations"],bannedSourceTypes:["private/paywalled footage obtained by bypassing access controls","stolen or leaked footage"],rationale:"Surface strong editorial sources while clearly preserving rights-risk labels. Publicly viewable does not itself grant repost rights."},
 musicPolicy:{soundPalette:["warm vintage soul","Fleetwood Mac / classic-rock nostalgia","Remember the Titans-style cinematic sports score","Americana and old-record energy","tasteful country such as Turnpike Troubadours, George Strait, Tyler Childers or Flatland Cavalry-type energy","Spirit in the Sky-style vintage energy"],usageRule:"Suggest exactly 3 ranked songs. Music supports, never replaces, the energy of original announcer calls. Commercial music should be added through licensed in-app libraries where available.",rationale:"Film Room should feel nostalgic, soulful, cinematic and human rather than like generic hype content."},
 penalties:[
  {key:"wrong_sport",description:"Anything other than men's college football or men's college basketball, including all women's sports, NFL and NBA.",penalty:10},
  {key:"caption_mismatch",description:"Any primary highlight falls outside the exact player, team, game, season, career, rivalry, comeback or claim promised by the caption.",penalty:10},
  {key:"no_announcer",description:"A primary highlight lacks original broadcast/announcer commentary. Non-broadcast footage may only be supporting material.",penalty:5},
  {key:"atmosphere_only",description:"Crowd, band, entrance, stadium, tailgate or tradition footage is the subject instead of supporting actual highlights.",penalty:6},
  {key:"mediocre_highlights",description:"Concept uses merely available clips instead of the genuinely best fitting highlights.",penalty:4},
  {key:"weak_footage",description:"Not enough strong searchable footage or source diversity to build the promised reel.",penalty:3},
  {key:"forced_variety",description:"A weaker idea is included only to diversify sports/categories.",penalty:3},
  {key:"overused_clip",description:"Same moment or angle has run recently without a compelling new reason.",penalty:2}
 ],
 voice:{principles:[
  "Film Room covers ONLY men's college football and men's college basketball.",
  "Highlights are the foundation. The actual sports footage must be great enough to earn the reel.",
  "The caption is a contract: every primary clip must exactly satisfy its scope and claim.",
  "Find the BEST highlights, not merely usable highlights.",
  "Original announcer calls are part of the Film Room identity.",
  "Atmosphere and alternate angles are seasoning; broadcast highlights are the meal.",
  "Optimize for shares, follows, rewatchability and long-term brand taste rather than filling slots.",
  "Current content gets priority only when it is actually strong; evergreen greatness can beat mediocre news.",
  "Do not force category diversity. Protect quality and taste above quotas.",
  "Sports Update watches possibilities; Today's Dose only recommends reel concepts that are already real and postable.",
  "A live or upcoming game is never a reel concept by itself. Wait for a verified play, performance, comeback, upset, record, or other actual event.",
  "Keep an evergreen bench of timeless college football and basketball highlights that can be posted whenever current games have not earned the slot."
 ],bannedPhrases:["You won't believe","Here are today's top","craziest ever!!!","follow for more"],captionStyle:"Short, confident and specific. The caption defines the footage scope and must never promise something the edit does not deliver.",coverStyle:"One strong action frame or emotionally loaded sports frame; subtle title if needed; no collage."},
 editorialRules:{
  coreSports:["men's college football","men's college basketball"],
  currentVsFlashback:"Dynamically favor whichever of men's college football or men's college basketball has the strongest current cultural attention. During football season, football can occupy all five pitches if it has the best ideas. During March Madness/basketball peaks, basketball may dominate. Never force a quota and never use women's sports.",
  generalHypeFanRule:"Every reel stays on one coherent subject promised by its caption. For general team/player highlights preserve a clear emotional point of view.",
  rivalryException:"Rivalry or matchup reels may celebrate huge plays from both sides because the rivalry/game itself is the subject, but every clip must remain within that matchup premise.",
  replacementRule:"Provide exactly 3 pre-vetted replacement clips that preserve the caption scope and can replace named primary clips without weakening the reel.",
  sourceRule:"Primary highlights MUST have original broadcast/announcer commentary. Prefer one excellent long-form broadcast or official highlight video that can carry the entire 18–24 second reel with grounded timestamps. Supporting footage is optional, not required. Never use Shorts, Reel-style edits, TikTok reposts, fan montages or creator compilations as the primary source. Never invent timestamps.",
  cameraAngleRule:"For major plays provide a primary broadcast angle with announcer audio plus a useful alternate angle when available. Alternate angles are optional editorial tools, not mandatory duplicate clips. Fan/field-level angles are supporting footage unless they contain the required broadcast commentary.",
  reelLengthRule:"Use the shortest runtime that fully delivers the concept. Single insane moments may be 8-15 seconds; most reels 15-30 seconds; longer only when the content earns it.",
  templates:[
   {name:"PLAYER_SPOTLIGHT",job:"NO INTERVIEW. One male college player. Caption + genuinely best broadcast highlights with announcers from exactly one game, one season, or the player's college career as promised by the caption. If the caption makes a trait claim, every highlight must prove that trait."},
   {name:"TEAM_SCHOOL_SPOTLIGHT",job:"NO INTERVIEW. One men's college team/program. Caption + genuinely best broadcast highlights with announcers from the exact game, season, historic comeback/game, or era promised. Crowd/stadium/fan footage may briefly introduce or support the reel but cannot become the reel."},
   {name:"MOMENT_GAME",job:"NO INTERVIEW. One rivalry/matchup, one recent game, or one insane play. Stay on that exact topic for the entire reel. A single extraordinary play may use setup, broadcast call, replay, alternate angle and reaction rather than padding with unrelated highlights."},
   {name:"STORY",job:"ALWAYS begins with a verified real interview from a male college player or coach. Then transition into broadcast highlights with announcers that directly visualize and support exactly what the interview says. Player interview -> that player's relevant highlights. Coach interview -> that team's relevant highlights. Never invent/paraphrase a quote or use unrelated highlights."},
   {name:"TIMELESS_HIGHLIGHT",job:"EVERGREEN. No interview. A legendary or simply irresistible men's college football/basketball highlight, sequence, comeback, rivalry ending, player takeover or classic moment that does not depend on today's news cycle. It should still be worth posting months from now. Prefer one coherent broadcast source with announcer audio and a satisfying setup/payoff."}
  ]
 }
};
