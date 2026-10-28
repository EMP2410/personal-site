---
title: "Element by element: what XAFS tells you that a diffractometer cannot"
date: 2026-08-18T10:00:00+08:00
description: "Diffraction averages over the crystal. Absorption spectroscopy picks out one element at a time. For catalysis and battery interfaces, that difference is the whole game."
tags: ["XAFS", "synchrotron", "characterisation"]
categories: ["Research"]
---

A powder diffractometer gives you a beautiful, quantitative answer about a
crystal: what the lattice is, how big it is, how strained. It also gives you
an answer about the *average* crystal, and it only speaks about atoms that are
heavy enough to be heard.

X-ray absorption fine structure spectroscopy works differently. It is
element-specific by construction: the absorption edge of a given element is at
a given energy, so by tuning the photon energy you choose which element you
are looking at, and everything else in the sample goes quiet.

## Two questions, two instruments

The distinction I find useful:

- **Diffraction** asks *what is the average structure?*
- **XAFS** asks *what is the local environment of this particular element?*

Those questions overlap constantly, and neither subsumes the other.

Consider a supported catalyst: nanoparticles of one metal on an oxide of
another. Diffraction tells you the lattice parameters of the oxide and, if the
particles are large enough, the fcc or hcp stacking of the metal. It says
almost nothing about whether the metal atoms have migrated onto the support,
or whether a small fraction of them has been reduced to a state the bulk
powder would never reveal.

XAFS, tuned to the absorber edge, does not care about crystallinity at all.
The coordination number, the bond distances, the degree of order in the first
shell, the valence — all of it comes out of a spectrum that is specific to one
element in one chemical environment. And because the measurement is fast
compared to a diffractometer scan, it can be done *while the cell is
charging*.

## Why we put one in Hong Kong

We installed Hong Kong's first benchtop XAFS spectrometer in the JC STEM Lab
of Energy and Materials Physics. It was a long procurement, and it was worth
it, for a reason that is not really about the instrument itself.

Before this existed, the practical option for any local student who wanted
element-specific local structure was a beamline proposal: a competitive
process, a fixed deadline, a slot months or years away, and a learning curve
that begins only once you are already on a remote beamtime. That is a
terrible way to learn, and a terrible way to develop a research direction.

With a local instrument, the loop changes. A student can bring a sample down
the corridor, get a spectrum in an afternoon, look at it, and decide what to
do next. That is what turns a technique into a method — and it is why the
XAFS sits in a lab that also has a Rigaku SmartLab surface diffractometer, a
laser ARPES–MBE system for surface and electronic structure, inert-atmosphere
gloveboxes, battery test cabinets and high-temperature stages.

## The instrument does not make the science

What the XAFS gives you is a spectrum, and a spectrum is an interpretation
problem. Standard references, background subtraction, normalisation, fitting
with a sensible number of parameters — the modelling choices matter as much as
the data, and the failure mode is a beautiful fit to a wrong structure.

Which is the real argument for having these instruments locally and teaching
them properly: not so that the measurement can be done, but so that it can be
done *by the people who will go on to do the next, harder measurement*. We
have students arriving from our undergraduate courses who leave able to take
a spectrum, a reference, and a claim about oxidation state back to their
bench. That is the whole point of a lab.

---

*Related: [Establishment of the Core Materials and Physics Characterization
Platform]({{< relref "/news/characterisation-platform" >}})*
