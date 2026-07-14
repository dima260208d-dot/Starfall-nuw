import pathlib

root = pathlib.Path(__file__).resolve().parent.parent
install = (root / "scripts" / "install-ranked-ui-assets.mjs")
install.write_text(
    (root / "scripts" / "_install_ranked_body.txt").read_text(encoding="utf-8"),
    encoding="utf-8",
    newline="\n",
)
print("wrote", install)
