import Image from "next/image";
import type { CSSProperties } from "react";
import type { HeroImage, HeroSlideView } from "@/lib/home/hero-slides";
import type { Translate } from "@/lib/i18n/translate";

/*
 * One slide of the home hero showcase (owner, 2026-10-11; Design/home-hero). Every size is a share of the
 * showcase's own width (cqw, the showcase is a size container), so the whole picture scales as one piece.
 * The product items and cards are drawn in CSS, as in the design.
 */

const cq = (n: number) => `${n}cqw`;
const shadow = (y: number, blur: number, a: number) => `0 ${cq(y)} ${cq(blur)} rgba(17,18,22,${a})`;

/** Pictures an admin uploaded are already sized by the server (and come through /api/site-img), so they skip the optimizer. */
const fromStorage = (src: string) => /^https?:\/\//.test(src) || src.startsWith("/api/site-img/");

/** A logo at a width relative to the showcase; slide 1 loads first, the others lazily. */
function Logo({ image, width, first }: { image: HeroImage; width: number; first: boolean }) {
  return (
    <Image
      src={image.src}
      unoptimized={fromStorage(image.src)}
      alt=""
      width={image.width}
      height={image.height}
      sizes="140px"
      preload={first}
      loading={first ? "eager" : "lazy"}
      style={{ width: cq(width), height: "auto", display: "block" }}
    />
  );
}

/** The three short lines on a business card. */
function CardLines() {
  return (
    <>
      <span style={{ width: "62%", height: cq(1.3), borderRadius: 9, background: "rgba(255,255,255,.9)" }} />
      <span style={{ width: "40%", height: cq(0.9), borderRadius: 9, background: "rgba(255,255,255,.5)" }} />
      <span style={{ width: "52%", height: cq(0.9), borderRadius: 9, background: "rgba(255,255,255,.5)" }} />
    </>
  );
}

function Item({ slide, first }: { slide: HeroSlideView; first: boolean }) {
  const { main, dark, light } = slide.colors;
  const logo = <Logo image={slide.logoWhite} width={slide.logoSize.item} first={first} />;
  const abs: CSSProperties = { position: "absolute" };
  switch (slide.item) {
    case "cup":
      return (
        <div className="lc-bob" style={{ left: "12%", top: "13%", width: "26%", height: "62%", animationDelay: "-2s", filter: `drop-shadow(0 ${cq(2.5)} ${cq(3)} rgba(17,18,22,.22))` }}>
          <span style={{ ...abs, left: "2%", right: "2%", top: 0, height: "9%", borderRadius: `${cq(2)} ${cq(2)} ${cq(0.6)} ${cq(0.6)}`, background: dark }} />
          <span style={{ ...abs, left: 0, right: 0, top: "8%", height: "6%", borderRadius: cq(1), background: main }} />
          <span
            style={{
              ...abs,
              left: "4%",
              right: "4%",
              top: "14%",
              bottom: 0,
              clipPath: "polygon(0 0, 100% 0, 86% 100%, 14% 100%)",
              background: `linear-gradient(180deg, ${main} 0 58%, ${light} 58% 100%)`,
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "center",
              paddingTop: "22%",
            }}
          >
            {logo}
          </span>
        </div>
      );
    case "ticket":
      return (
        <div
          className="lc-bob"
          style={{ left: "5%", top: "14%", width: "34%", height: "44%", animationDelay: "-2s", transform: "rotate(-7deg)", borderRadius: cq(1.8), background: light, overflow: "hidden", boxShadow: shadow(2.5, 5, 0.25), display: "flex", flexDirection: "column" }}
        >
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "52%", background: `linear-gradient(160deg, ${main}, ${dark})` }}>{logo}</span>
          <span style={{ height: 0, borderTop: `${cq(0.4)} dashed #B9BCC4` }} />
          <span style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: cq(1.2), padding: `0 ${cq(3)}` }}>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", font: `700 ${cq(3.2)} var(--font-lc-heading), sans-serif`, color: main }}>
              DAC
              <span style={{ flex: 1, margin: `0 ${cq(1.5)}`, borderTop: `${cq(0.3)} solid #C9CCD3` }} />
              CXB
            </span>
            <span style={{ width: "70%", height: cq(0.9), borderRadius: 9, background: "#D5D7DD" }} />
            <span style={{ width: "45%", height: cq(0.9), borderRadius: 9, background: "#D5D7DD" }} />
          </span>
        </div>
      );
    case "bag":
      return (
        <div className="lc-bob" style={{ left: "9%", top: "12%", width: "30%", height: "58%", animationDelay: "-2s", filter: `drop-shadow(0 ${cq(2.5)} ${cq(3)} rgba(17,18,22,.22))` }}>
          <span style={{ ...abs, left: "30%", right: "30%", top: 0, height: "26%", border: `${cq(1.2)} solid ${dark}`, borderBottom: 0, borderRadius: `${cq(99)} ${cq(99)} 0 0` }} />
          <span
            style={{ ...abs, left: 0, right: 0, top: "20%", bottom: 0, borderRadius: `${cq(1)} ${cq(1)} ${cq(2)} ${cq(2)}`, background: `linear-gradient(160deg, ${main}, ${dark})`, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            {logo}
          </span>
          <span style={{ ...abs, left: 0, right: 0, top: "20%", height: "5%", background: "rgba(0,0,0,.12)", borderRadius: `${cq(1)} ${cq(1)} 0 0` }} />
        </div>
      );
    case "phone":
      return (
        <div className="lc-bob" style={{ left: "11%", top: "10%", width: "25%", height: "64%", animationDelay: "-2s", borderRadius: cq(3.4), background: "#111216", padding: cq(1), filter: `drop-shadow(0 ${cq(2.5)} ${cq(3)} rgba(17,18,22,.28))` }}>
          <span
            style={{ ...abs, inset: cq(1), borderRadius: cq(2.6), background: `linear-gradient(170deg, ${main}, ${dark})`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: cq(3) }}
          >
            {logo}
            <span style={{ width: "46%", height: cq(1), borderRadius: 9, background: "rgba(255,255,255,.55)" }} />
            <span style={{ width: "30%", height: cq(1), borderRadius: 9, background: "rgba(255,255,255,.35)" }} />
          </span>
          <span style={{ ...abs, left: "36%", right: "36%", top: cq(2), height: cq(1.4), borderRadius: 9, background: "#111216" }} />
        </div>
      );
  }
}

/** The showcase picture of one slide (photo, product, two cards, badge, name chip, caption). */
export function ShowcaseArt({ slide, first, t }: { slide: HeroSlideView; first: boolean; t: Translate }) {
  const { main, dark, light, badge } = slide.colors;
  return (
    <>
      <div style={{ left: "30%", top: "9%", width: "55%", height: "72%", borderRadius: cq(3), overflow: "hidden", background: "#6E6C6A" }}>
        <Image
          src={slide.photo.src}
          unoptimized={fromStorage(slide.photo.src)}
          alt=""
          fill
          sizes="(max-width: 940px) 60vw, 360px"
          preload={first}
          loading={first ? "eager" : "lazy"}
          style={{ objectFit: "cover", objectPosition: slide.photo.position }}
        />
      </div>
      <Item slide={slide} first={first} />
      {/* Dark business card */}
      <div
        className="lc-bob"
        style={{
          left: 0,
          top: "55%",
          width: "34%",
          height: "25%",
          borderRadius: cq(1.2),
          background: `linear-gradient(135deg, ${main}, ${dark})`,
          transform: "rotate(-13deg)",
          animationDelay: "-4s",
          boxShadow: shadow(2, 4, 0.25),
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: cq(1),
          padding: `0 ${cq(3)}`,
        }}
      >
        <CardLines />
      </div>
      {/* Light business card with the logo */}
      <div
        className="lc-bob"
        style={{
          left: "19%",
          top: "64%",
          width: "37%",
          height: "28%",
          borderRadius: cq(1.2),
          background: light,
          borderBottom: `${cq(1.2)} solid ${main}`,
          transform: "rotate(-21deg)",
          animationDelay: "-1s",
          boxShadow: shadow(2.5, 5, 0.28),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Logo image={slide.logo} width={slide.logoSize.card} first={first} />
      </div>
      {/* Round logo badge */}
      <div
        className="lc-bob"
        style={{ right: "2%", top: 0, width: "25%", aspectRatio: 1, borderRadius: "50%", background: badge, animationDelay: "-3s", boxShadow: shadow(2, 4, 0.18), display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <Logo image={slide.badgeLogo === "white" ? slide.logoWhite : slide.logo} width={slide.logoSize.badge} first={first} />
      </div>
      {/* Role and name chip */}
      <div
        style={{
          right: 0,
          top: "66%",
          display: "flex",
          alignItems: "center",
          gap: cq(1.4),
          padding: `${cq(1)} ${cq(2.6)} ${cq(1)} ${cq(1)}`,
          borderRadius: 99,
          background: "#FFE27A",
          boxShadow: shadow(1.5, 3, 0.2),
          font: `700 ${cq(2.5)} var(--font-lc-body), var(--font-bn-digits), var(--font-bangla), sans-serif`,
          whiteSpace: "nowrap",
          color: "#111216",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: cq(5.2), height: cq(5.2), borderRadius: "50%", background: "#111216", color: "#fff", fontSize: cq(2.3) }}>
          {slide.name.charAt(0).toUpperCase()}
        </span>
        {t(slide.role === "designer" ? "home.hero.chipDesigner" : "home.hero.chipClient", { name: slide.name })}
      </div>
      {/* Caption */}
      <span style={{ right: "15%", top: "83%", font: `italic 500 ${cq(2.5)} Georgia, var(--font-bn-digits), var(--font-bangla), serif`, color: "#3A3C45", whiteSpace: "nowrap" }}>
        {t(slide.role === "designer" ? "home.hero.captionDesigner" : "home.hero.captionClient", { brand: slide.brand })}
      </span>
    </>
  );
}

/** The headline and line of text of one slide. Only the first slide's headline is the page's h1. */
export function SlideText({ slide, first }: { slide: HeroSlideView; first: boolean }) {
  const Heading = first ? "h1" : "div";
  return (
    <>
      <Heading className="lc-hero-title m-0">
        {slide.copy.line1}
        <br />
        {slide.copy.line2}
      </Heading>
      <p className="m-0 max-w-[480px] text-[19px] text-[#3A3C45]">{slide.copy.text}</p>
    </>
  );
}
