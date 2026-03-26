"""Tests for cli.py — CLI entry point."""

import json
import os
import tempfile
import pytest

from agent_service_agreements.cli import main


@pytest.fixture
def store_dir(tmp_path):
    return str(tmp_path / ".asa")


class TestCLI:
    def test_no_command(self, capsys):
        ret = main([])
        assert ret == 0
        out = capsys.readouterr().out
        assert "agent-service" in out

    def test_templates(self, capsys):
        ret = main(["templates"])
        assert ret == 0
        out = capsys.readouterr().out
        assert "research" in out
        assert "code_generation" in out

    def test_agree(self, store_dir, capsys):
        ret = main([
            "--store", store_dir,
            "agree",
            "--template", "research",
            "--client", "alice",
            "--provider", "bob",
        ])
        assert ret == 0
        out = capsys.readouterr().out
        assert "Agreement created" in out

    def test_agree_with_escrow(self, store_dir, capsys):
        ret = main([
            "--store", store_dir,
            "agree",
            "--template", "general",
            "--client", "alice",
            "--provider", "bob",
            "--amount", "5.00",
            "--json",
        ])
        assert ret == 0
        data = json.loads(capsys.readouterr().out)
        assert data["escrow"]["enabled"] is True

    def test_verify_file(self, store_dir, tmp_path, capsys):
        # Write a test deliverable
        f = tmp_path / "deliverable.md"
        f.write_text("# Test\n\nThis is a test deliverable with some content.\n" * 10)

        ret = main([
            "--store", store_dir,
            "verify",
            "--deliverable", str(f),
            "--request", "Write a test document",
            "--type", "general",
        ])
        assert ret == 0
        out = capsys.readouterr().out
        assert "Verification" in out

    def test_verify_json_output(self, store_dir, tmp_path, capsys):
        f = tmp_path / "deliverable.txt"
        f.write_text("Content " * 100)

        ret = main([
            "--store", store_dir,
            "verify",
            "--deliverable", str(f),
            "--json",
        ])
        assert ret == 0
        data = json.loads(capsys.readouterr().out)
        assert "verification_id" in data
        assert "composite" in data

    def test_status(self, store_dir, capsys):
        ret = main(["--store", store_dir, "status"])
        assert ret == 0
        out = capsys.readouterr().out
        assert "Store Status" in out

    def test_status_json(self, store_dir, capsys):
        ret = main(["--store", store_dir, "status", "--json"])
        assert ret == 0
        data = json.loads(capsys.readouterr().out)
        assert "agreements" in data

    def test_negotiate_accept(self, store_dir, capsys):
        # First create an agreement
        main([
            "--store", store_dir,
            "agree", "--template", "general",
            "--client", "alice", "--provider", "bob",
            "--json",
        ])
        data = json.loads(capsys.readouterr().out)
        aid = data["agreement_id"]

        # Accept negotiation
        ret = main([
            "--store", store_dir,
            "negotiate",
            "--agreement-id", aid,
            "--action", "accept",
            "--sender", "bob",
        ])
        assert ret == 0

    def test_negotiate_missing_agreement(self, store_dir, capsys):
        ret = main([
            "--store", store_dir,
            "negotiate",
            "--agreement-id", "nonexistent",
            "--action", "accept",
            "--sender", "bob",
        ])
        assert ret == 1
